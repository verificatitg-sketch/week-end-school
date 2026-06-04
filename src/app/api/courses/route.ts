import { NextResponse } from 'next/server';
import { turso, db, mapUserToApi } from '@/lib/db';
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
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const conditions: string[] = ['c.published = 1'];
    const args: unknown[] = [];

    if (category) {
      conditions.push('c.category = ?');
      args.push(category);
    }

    const whereClause = ' WHERE ' + conditions.join(' AND ');

    // Get courses with enrollment count and module count via subqueries
    const coursesRes = await db.execute({
      sql: `SELECT c.*,
             (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) as enrollment_count,
             (SELECT COUNT(*) FROM course_modules cm WHERE cm.course_id = c.id) as module_count
             FROM courses c
             ${whereClause}
             ORDER BY c.created_at DESC`,
      args,
    });

    // Map the response to match the expected format (camelCase + _count)
    const mapped = coursesRes.rows.map((row) => {
      const c = row as Record<string, unknown>;
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        level: c.level,
        thumbnail: c.thumbnail,
        duration: c.duration,
        rating: c.rating,
        published: !!c.published,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        _count: {
          enrollments: c.enrollment_count as number || 0,
          modules: c.module_count as number || 0,
        },
      };
    });

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
    const { title, description, category, level, thumbnail, duration } = body;

    if (!title || !description || !category) {
      return NextResponse.json(
        { error: 'Title, description, and category are required' },
        { status: 400 }
      );
    }

    const course = await turso.course.create({
      title,
      description,
      category,
      level: level || 'beginner',
      thumbnail: thumbnail || null,
      duration: duration || 0,
      published: 0, // SQLite boolean: false = 0
    });

    if (!course) {
      return NextResponse.json(
        { error: 'Failed to create course' },
        { status: 500 }
      );
    }

    // Map course to camelCase
    const mapped = {
      id: (course as Record<string, unknown>).id,
      title: (course as Record<string, unknown>).title,
      description: (course as Record<string, unknown>).description,
      category: (course as Record<string, unknown>).category,
      level: (course as Record<string, unknown>).level,
      thumbnail: (course as Record<string, unknown>).thumbnail,
      duration: (course as Record<string, unknown>).duration,
      rating: (course as Record<string, unknown>).rating,
      published: !!((course as Record<string, unknown>).published),
      createdAt: (course as Record<string, unknown>).created_at,
      updatedAt: (course as Record<string, unknown>).updated_at,
    };

    return NextResponse.json({ course: mapped }, { status: 201 });
  } catch (error) {
    console.error('Create course error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
