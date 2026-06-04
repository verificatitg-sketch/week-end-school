import { NextResponse } from 'next/server';
import { supabaseAdmin, sb } from '@/lib/supabase';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

async function getAuthUser(request: Request) {
  const token = getTokenFromHeaders(request.headers);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const user = await sb.user.findUnique({ id: payload.userId as string });
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

    // Check post exists
    const { data: post } = await supabaseAdmin
      .from('community_posts')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Check if already liked
    const { data: existingLike } = await supabaseAdmin
      .from('likes')
      .select('id')
      .eq('post_id', id)
      .eq('user_id', user.id)
      .single();

    if (existingLike) {
      // Unlike
      await supabaseAdmin
        .from('likes')
        .delete()
        .eq('id', existingLike.id);
      return NextResponse.json({ liked: false });
    } else {
      // Like
      await supabaseAdmin.from('likes').insert({
        post_id: id,
        user_id: user.id,
      });

      // Notify post author
      if (post.user_id !== user.id) {
        await supabaseAdmin.from('notifications').insert({
          user_id: post.user_id,
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
