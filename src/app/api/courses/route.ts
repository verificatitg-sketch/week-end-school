import { NextResponse } from 'next/server';
import { supabaseAdmin, sb, mapUserToApi, mapUserToDb } from '@/lib/supabase';
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
      .from('courses')
      .select('*, enrollments(count), modules:course_modules(count)')
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: courses, error } = await query;
    if (error) throw error;

    // Map the response to match Prisma format (camelCase + _count)
    const mapped = (courses || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category,
      level: c.level,
      thumbnail: c.thumbnail,
      duration: c.duration,
      rating: c.rating,
      published: c.published,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      _count: {
        enrollments: c.enrollments?.[0]?.count || 0,
        modules: c.modules?.[0]?.count || 0,
      },
    }));

    return NextResponse.json({ courses: mapped });
  } catch (error) {
    console.error('Get courses error:', error);
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

    const isAuthorized =
      user.role?.name === 'SUPER_ADMIN' ||
      user.role?.name === 'ADMIN' ||
      user.role?.name === 'FORMATEUR';

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, description, category, level, thumbnail, duration } = body;

    if (!title || !description || !category) {
      return NextResponse.json(
        { error: 'Title, description, and category are required' },
        { status: 400 }
      );
    }

    const { data: course, error } = await supabaseAdmin
      .from('courses')
      .insert({
        title,
        description,
        category,
        level: level || 'beginner',
        thumbnail: thumbnail || null,
        duration: duration || 0,
        published: false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    console.error('Create course error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
