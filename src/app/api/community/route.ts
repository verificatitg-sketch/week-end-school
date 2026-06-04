import { NextResponse } from 'next/server';
import { turso, mapUserToApi } from '@/lib/db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

async function getAuthUser(request: Request) {
  const token = getTokenFromHeaders(request.headers);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const user = await turso.user.findUnique({ id: payload.userId as string });
  return user;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let sql = `
      SELECT cp.*, u.id as user_id, u.name as user_name, u.avatar as user_avatar,
        (SELECT COUNT(*) FROM comments WHERE post_id = cp.id) as comment_count,
        (SELECT COUNT(*) FROM likes WHERE post_id = cp.id) as like_count
      FROM community_posts cp
      LEFT JOIN users u ON cp.user_id = u.id
    `;
    const args: unknown[] = [];

    if (category) {
      sql += ' WHERE cp.category = ?';
      args.push(category);
    }

    sql += ' ORDER BY cp.pinned DESC, cp.created_at DESC';

    const result = await turso.query(sql, args);

    const mapped = result.rows.map((p: any) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      category: p.category,
      userId: p.user_id,
      pinned: !!p.pinned,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      user: p.user_id ? { id: p.user_id, name: p.user_name, avatar: p.user_avatar } : null,
      _count: {
        comments: p.comment_count || 0,
        likes: p.like_count || 0,
      },
    }));

    return NextResponse.json({ posts: mapped });
  } catch (error) {
    console.error('Get community posts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, content, category } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const postId = await turso.insert('community_posts', {
      title,
      content,
      category: category || 'general',
      user_id: user.id,
      pinned: 0,
    });

    // Fetch the created post with user info
    const result = await turso.query(
      `SELECT cp.*, u.id as user_id, u.name as user_name, u.avatar as user_avatar
       FROM community_posts cp
       LEFT JOIN users u ON cp.user_id = u.id
       WHERE cp.id = ?`,
      [postId]
    );

    const p = result.rows[0] as any;
    const post = {
      id: p.id,
      title: p.title,
      content: p.content,
      category: p.category,
      userId: p.user_id,
      pinned: !!p.pinned,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      user: p.user_id ? { id: p.user_id, name: p.user_name, avatar: p.user_avatar } : null,
    };

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error('Create post error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
