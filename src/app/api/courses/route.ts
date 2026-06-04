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
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const where: Record<string, unknown> = { published: true };
    if (category) {
      where.category = category;
    }

    const courses = await db.course.findMany({
      where,
      include: {
        _count: { select: { enrollments: true, modules: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ courses });
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

    const isAdmin =
      user.role?.name === 'SUPER_ADMIN' ||
      user.role?.name === 'ADMIN' ||
      user.role?.name === 'FORMATEUR';

    if (!isAdmin) {
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

    const course = await db.course.create({
      data: {
        title,
        description,
        category,
        level: level || 'beginner',
        thumbnail: thumbnail || null,
        duration: duration || 0,
        published: false,
      },
    });

    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    console.error('Create course error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
