import { NextResponse } from 'next/server';
import { turso, db } from '@/lib/db';
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
      user.role_name === 'SUPER_ADMIN' || user.role_name === 'ADMIN';
    if (targetUserId !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get enrollments with course and module count
    const enrollmentsRes = await db.execute({
      sql: `SELECT e.*,
             (SELECT COUNT(*) FROM course_modules cm WHERE cm.course_id = e.course_id) as module_count
             FROM enrollments e
             WHERE e.user_id = ?
             ORDER BY e.enrolled_at DESC`,
      args: [targetUserId],
    });

    // Get certificates for all these enrollments
    const enrollmentIds = enrollmentsRes.rows.map((r) => (r as Record<string, unknown>).id as string);

    // Get courses for the enrollments
    const courseIds = enrollmentsRes.rows.map((r) => (r as Record<string, unknown>).course_id as string);

    // Batch fetch courses
    const coursesMap: Record<string, Record<string, unknown>> = {};
    if (courseIds.length > 0) {
      const placeholders = courseIds.map(() => '?').join(',');
      const coursesRes = await db.execute({
        sql: `SELECT * FROM courses WHERE id IN (${placeholders})`,
        args: courseIds,
      });
      for (const c of coursesRes.rows) {
        const course = c as Record<string, unknown>;
        coursesMap[course.id as string] = course;
      }
    }

    // Batch fetch certificates
    const certsMap: Record<string, Record<string, unknown>> = {};
    if (enrollmentIds.length > 0) {
      const placeholders = enrollmentIds.map(() => '?').join(',');
      const certsRes = await db.execute({
        sql: `SELECT * FROM certificates WHERE enrollment_id IN (${placeholders})`,
        args: enrollmentIds,
      });
      for (const cert of certsRes.rows) {
        const c = cert as Record<string, unknown>;
        if (c.enrollment_id) {
          certsMap[c.enrollment_id as string] = c;
        }
      }
    }

    // Map to camelCase
    const mapped = enrollmentsRes.rows.map((row) => {
      const e = row as Record<string, unknown>;
      const rawCourse = coursesMap[e.course_id as string];
      const rawCert = certsMap[e.id as string];

      return {
        id: e.id,
        userId: e.user_id,
        courseId: e.course_id,
        progress: e.progress,
        completed: !!e.completed,
        enrolledAt: e.enrolled_at,
        updatedAt: e.updated_at,
        course: rawCourse ? {
          ...rawCourse,
          createdAt: rawCourse.created_at,
          updatedAt: rawCourse.updated_at,
          published: !!rawCourse.published,
          _count: {
            modules: e.module_count as number || 0,
          },
        } : null,
        certificate: rawCert ? {
          ...rawCert,
          qrCode: rawCert.qr_code,
          issuedAt: rawCert.issued_at,
          userId: rawCert.user_id,
          enrollmentId: rawCert.enrollment_id,
        } : null,
      };
    });

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
    const courseRow = await turso.course.findUnique({ id: courseId });
    if (!courseRow) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    const course = courseRow as Record<string, unknown>;
    if (!course.published) {
      return NextResponse.json(
        { error: 'Course is not available for enrollment' },
        { status: 400 }
      );
    }

    // Check if already enrolled
    const existingRes = await db.execute({
      sql: 'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?',
      args: [user.id, courseId],
    });

    if (existingRes.rows.length > 0) {
      return NextResponse.json(
        { error: 'Already enrolled in this course' },
        { status: 409 }
      );
    }

    // Create enrollment
    const enrollmentId = await turso.insert('enrollments', {
      user_id: user.id,
      course_id: courseId,
      progress: 0,
      completed: 0,
    });

    // Fetch the created enrollment with course
    const enrollmentRes = await db.execute({
      sql: 'SELECT * FROM enrollments WHERE id = ?',
      args: [enrollmentId],
    });

    const enrollment = enrollmentRes.rows[0] as Record<string, unknown>;

    // Create notification
    await turso.insert('notifications', {
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
      completed: !!enrollment.completed,
      enrolledAt: enrollment.enrolled_at,
      updatedAt: enrollment.updated_at,
      course: course,
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
