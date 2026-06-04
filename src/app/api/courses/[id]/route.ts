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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get course
    const courseRow = await turso.course.findUnique({ id });
    if (!courseRow) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    const course = courseRow as Record<string, unknown>;

    // Get enrollment count
    const enrollCountRes = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM enrollments WHERE course_id = ?',
      args: [id],
    });
    const enrollmentCount = (enrollCountRes.rows[0] as Record<string, unknown>)?.count as number || 0;

    // Get modules with lessons
    const modulesRes = await db.execute({
      sql: 'SELECT * FROM course_modules WHERE course_id = ? ORDER BY "order" ASC',
      args: [id],
    });

    const modulesWithLessons = await Promise.all(
      modulesRes.rows.map(async (modRow) => {
        const mod = modRow as Record<string, unknown>;
        const lessonsRes = await db.execute({
          sql: 'SELECT * FROM lessons WHERE module_id = ? ORDER BY "order" ASC',
          args: [mod.id as string],
        });
        return {
          ...mod,
          lessons: lessonsRes.rows,
        };
      })
    );

    // Sort modules and lessons by order
    const sortedModules = modulesWithLessons
      .sort((a, b) => ((a.order as number) || 0) - ((b.order as number) || 0))
      .map((m) => ({
        ...m,
        lessons: (m.lessons as Array<Record<string, unknown>>)
          .sort((a, b) => ((a.order as number) || 0) - ((b.order as number) || 0)),
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
      published: !!course.published,
      createdAt: course.created_at,
      updatedAt: course.updated_at,
      modules: sortedModules,
      _count: {
        enrollments: enrollmentCount,
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
      user.role_name === 'SUPER_ADMIN' ||
      user.role_name === 'ADMIN' ||
      user.role_name === 'FORMATEUR';

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
    if (published !== undefined) updateData.published = published ? 1 : 0;

    const updatedCourse = await turso.course.update({ id }, updateData);

    if (!updatedCourse) {
      return NextResponse.json(
        { error: 'Course not found or update failed' },
        { status: 404 }
      );
    }

    // Map to camelCase
    const mapped = {
      id: (updatedCourse as Record<string, unknown>).id,
      title: (updatedCourse as Record<string, unknown>).title,
      description: (updatedCourse as Record<string, unknown>).description,
      category: (updatedCourse as Record<string, unknown>).category,
      level: (updatedCourse as Record<string, unknown>).level,
      thumbnail: (updatedCourse as Record<string, unknown>).thumbnail,
      duration: (updatedCourse as Record<string, unknown>).duration,
      rating: (updatedCourse as Record<string, unknown>).rating,
      published: !!((updatedCourse as Record<string, unknown>).published),
      createdAt: (updatedCourse as Record<string, unknown>).created_at,
      updatedAt: (updatedCourse as Record<string, unknown>).updated_at,
    };

    return NextResponse.json({ course: mapped });
  } catch (error) {
    console.error('Update course error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
