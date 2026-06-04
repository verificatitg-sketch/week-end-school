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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check post exists
    const { data: post } = await supabaseAdmin
      .from('community_posts')
      .select('id')
      .eq('id', id)
      .single();

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    const { data: comments, error } = await supabaseAdmin
      .from('comments')
      .select('*, user:users(id, name, avatar)')
      .eq('post_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const mapped = (comments || []).map((c: any) => ({
      id: c.id,
      content: c.content,
      postId: c.post_id,
      userId: c.user_id,
      createdAt: c.created_at,
      user: c.user,
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

    const { data: comment, error } = await supabaseAdmin
      .from('comments')
      .insert({
        content,
        post_id: id,
        user_id: user.id,
      })
      .select('*, user:users(id, name, avatar)')
      .single();

    if (error) throw error;

    // Notify the post author
    if (post.user_id !== user.id) {
      await supabaseAdmin.from('notifications').insert({
        user_id: post.user_id,
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
