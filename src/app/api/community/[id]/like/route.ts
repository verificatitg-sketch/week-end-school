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

    // Check if already liked
    const existingResult = await turso.query(
      'SELECT id FROM likes WHERE post_id = ? AND user_id = ?',
      [id, user.id]
    );

    if (existingResult.rows.length > 0) {
      // Unlike
      const likeId = (existingResult.rows[0] as any).id;
      await turso.query('DELETE FROM likes WHERE id = ?', [likeId]);
      return NextResponse.json({ liked: false });
    } else {
      // Like
      await turso.insert('likes', {
        post_id: id,
        user_id: user.id,
      });

      // Notify post author
      if (postUserId && postUserId !== user.id) {
        await turso.insert('notifications', {
          user_id: postUserId,
          title: 'Nouveau like',
          message: `${user.name} a aimé votre publication`,
          type: 'community',
          link: `/community/${id}`,
        });
      }

      return NextResponse.json({ liked: true }, { status: 201 });
    }
  } catch (error) {
    console.error('Toggle like error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
