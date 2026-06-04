import { NextResponse } from 'next/server';
import { turso } from '@/lib/db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

async function getAuthUser(request: Request) {
  const token = getTokenFromHeaders(request.headers);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const user = await turso.user.findUnique({ id: payload.userId as string });
  return user;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check post exists
    const postCheck = await turso.query(
      'SELECT id FROM community_posts WHERE id = ?',
      [id]
    );

    if (!postCheck.rows.length) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    const result = await turso.query(
      `SELECT c.*, u.id as user_id, u.name as user_name, u.avatar as user_avatar
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.post_id = ?
       ORDER BY c.created_at ASC`,
      [id]
    );

    const mapped = result.rows.map((c: any) => ({
      id: c.id,
      content: c.content,
      postId: c.post_id,
      userId: c.user_id,
      createdAt: c.created_at,
      user: c.user_id ? { id: c.user_id, name: c.user_name, avatar: c.user_avatar } : null,
    }));

    return NextResponse.json({ comments: mapped });
  } catch (error) {
    console.error('Get comments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // Check post exists and get author
    const postCheck = await turso.query(
      'SELECT user_id FROM community_posts WHERE id = ?',
      [id]
    );

    if (!postCheck.rows.length) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    const postUserId = (postCheck.rows[0] as any).user_id;

    const commentId = await turso.insert('comments', {
      content,
      post_id: id,
      user_id: user.id,
    });

    // Fetch the created comment with user info
    const result = await turso.query(
      `SELECT c.*, u.id as user_id, u.name as user_name, u.avatar as user_avatar
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [commentId]
    );

    const c = result.rows[0] as any;
    const comment = {
      id: c.id,
      content: c.content,
      postId: c.post_id,
      userId: c.user_id,
      createdAt: c.created_at,
      user: c.user_id ? { id: c.user_id, name: c.user_name, avatar: c.user_avatar } : null,
    };

    // Notify the post author
    if (postUserId && postUserId !== user.id) {
      await turso.insert('notifications', {
        user_id: postUserId,
        title: 'Nouveau commentaire',
        message: `${user.name} a commenté votre publication`,
        type: 'community',
        link: `/community/${id}`,
      });
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('Create comment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
