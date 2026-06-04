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
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Users can only see their own enrollments unless admin
    const targetUserId = userId || user.id;
    const isAdmin =
      user.role?.name === 'SUPER_ADMIN' || user.role?.name === 'ADMIN';
    if (targetUserId !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const { data: enrollments, error } = await supabaseAdmin
      .from('enrollments')
      .select('*, course:courses(*, modules:course_modules(count)), certificate:certificates(*)')
      .eq('user_id', targetUserId)
      .order('enrolled_at', { ascending: false });

    if (error) throw error;

    // Map to camelCase
    const mapped = (enrollments || []).map((e: any) => ({
      id: e.id,
      userId: e.user_id,
      courseId: e.course_id,
      progress: e.progress,
      completed: e.completed,
      enrolledAt: e.enrolled_at,
      updatedAt: e.updated_at,
      course: e.course ? {
        ...e.course,
        createdAt: e.course.created_at,
        updatedAt: e.course.updated_at,
        _count: {
          modules: e.course.modules?.[0]?.count || 0,
        },
      } : null,
      certificate: e.certificate && e.certificate.length > 0 ? {
        ...e.certificate[0],
        qrCode: e.certificate[0]?.qr_code,
        issuedAt: e.certificate[0]?.issued_at,
        userId: e.certificate[0]?.user_id,
        enrollmentId: e.certificate[0]?.enrollment_id,
      } : null,
    }));

    return NextResponse.json({ enrollments: mapped });
  } catch (error) {
    console.error('Get enrollments error:', error);
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
    const { courseId } = body;

    if (!courseId) {
      return NextResponse.json(
        { error: 'Course ID is required' },
        { status: 400 }
      );
    }

    // Check course exists and is published
    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    if (!course.published) {
      return NextResponse.json(
        { error: 'Course is not available for enrollment' },
        { status: 400 }
      );
    }

    // Check if already enrolled
    const { data: existing } = await supabaseAdmin
      .from('enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Already enrolled in this course' },
        { status: 409 }
      );
    }

    const { data: enrollment, error: enrollError } = await supabaseAdmin
      .from('enrollments')
      .insert({
        user_id: user.id,
        course_id: courseId,
      })
      .select('*, course:courses(*)')
      .single();

    if (enrollError) throw enrollError;

    // Create notification
    await supabaseAdmin.from('notifications').insert({
      user_id: user.id,
      title: 'Inscription réussie',
      message: `Vous êtes inscrit au cours "${course.title}"`,
      type: 'enrollment',
    });

    // Map response
    const mapped = {
      id: enrollment.id,
      userId: enrollment.user_id,
      courseId: enrollment.course_id,
      progress: enrollment.progress,
      completed: enrollment.completed,
      enrolledAt: enrollment.enrolled_at,
      updatedAt: enrollment.updated_at,
      course: enrollment.course,
    };

    return NextResponse.json({ enrollment: mapped }, { status: 201 });
  } catch (error) {
    console.error('Enrollment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
