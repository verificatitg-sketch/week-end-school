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
    include: { role: true },
  });
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

    const enrollments = await db.enrollment.findMany({
      where: { userId: targetUserId },
      include: {
        course: {
          include: {
            _count: { select: { modules: true } },
          },
        },
        certificate: true,
      },
      orderBy: { enrolledAt: 'desc' },
    });

    return NextResponse.json({ enrollments });
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
    const course = await db.course.findUnique({ where: { id: courseId } });
    if (!course) {
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
    const existing = await db.enrollment.findUnique({
      where: {
        userId_courseId: { userId: user.id, courseId },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Already enrolled in this course' },
        { status: 409 }
      );
    }

    const enrollment = await db.enrollment.create({
      data: {
        userId: user.id,
        courseId,
      },
      include: { course: true },
    });

    // Create notification
    await db.notification.create({
      data: {
        userId: user.id,
        title: 'Inscription réussie',
        message: `Vous êtes inscrit au cours "${course.title}"`,
        type: 'enrollment',
      },
    });

    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (error) {
    console.error('Enrollment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
