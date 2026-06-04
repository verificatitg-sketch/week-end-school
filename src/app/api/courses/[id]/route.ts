import { NextResponse } from 'next/server';
import { supabaseAdmin, sb, mapUserToDb } from '@/lib/supabase';
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

    // Get course with modules, lessons, and enrollment count
    const { data: course, error } = await supabaseAdmin
      .from('courses')
      .select('*, enrollments(count), modules:course_modules(*, lessons:lessons(*))')
      .eq('id', id)
      .single();

    if (error || !course) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    // Sort modules and lessons by order
    const sortedModules = (course.modules || [])
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
      .map((m: any) => ({
        ...m,
        lessons: (m.lessons || []).sort((a: any, b: any) => (a.order || 0) - (b.order || 0)),
      }));

    // Map to Prisma-like response
    const mapped = {
      id: course.id,
      title: course.title,
      description: course.description,
      category: course.category,
      level: course.level,
      thumbnail: course.thumbnail,
      duration: course.duration,
      rating: course.rating,
      published: course.published,
      createdAt: course.created_at,
      updatedAt: course.updated_at,
      modules: sortedModules,
      _count: {
        enrollments: course.enrollments?.[0]?.count || 0,
      },
    };

    return NextResponse.json({ course: mapped });
  } catch (error) {
    console.error('Get course error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const { title, description, category, level, thumbnail, duration, published } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (level !== undefined) updateData.level = level;
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail;
    if (duration !== undefined) updateData.duration = duration;
    if (published !== undefined) updateData.published = published;

    const { data: course, error } = await supabaseAdmin
      .from('courses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ course });
  } catch (error) {
    console.error('Update course error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
