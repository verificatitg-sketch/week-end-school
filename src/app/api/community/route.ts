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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let query = supabaseAdmin
      .from('community_posts')
      .select('*, user:users(id, name, avatar), comments(count), likes(count)')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: posts, error } = await query;
    if (error) throw error;

    const mapped = (posts || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      category: p.category,
      userId: p.user_id,
      pinned: p.pinned,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      user: p.user,
      _count: {
        comments: p.comments?.[0]?.count || 0,
        likes: p.likes?.[0]?.count || 0,
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

    const { data: post, error } = await supabaseAdmin
      .from('community_posts')
      .insert({
        title,
        content,
        category: category || 'general',
        user_id: user.id,
      })
      .select('*, user:users(id, name, avatar)')
      .single();

    if (error) throw error;

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error('Create post error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
