import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

async function getAuthUser(request: Request) {
  const token = getTokenFromHeaders(request.headers);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const user = await db.user.findUnique({
    where: { id: payload.userId as string },
  });
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

    const post = await db.communityPost.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Check if already liked
    const existingLike = await db.like.findUnique({
      where: {
        postId_userId: { postId: id, userId: user.id },
      },
    });

    if (existingLike) {
      // Unlike
      await db.like.delete({
        where: { id: existingLike.id },
      });
      return NextResponse.json({ liked: false });
    } else {
      // Like
      await db.like.create({
        data: {
          postId: id,
          userId: user.id,
        },
      });

      // Notify post author
      if (post.userId !== user.id) {
        await db.notification.create({
          data: {
            userId: post.userId,
            title: 'Nouveau like',
            message: `${user.name} a aimé votre publication`,
            type: 'community',
            link: `/community/${id}`,
          },
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
