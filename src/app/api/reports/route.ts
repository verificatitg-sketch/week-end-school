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

    const isAdmin =
      user.role?.name === 'SUPER_ADMIN' ||
      user.role?.name === 'ADMIN' ||
      user.role?.name === 'MODERATEUR';

    const where = isAdmin ? {} : { userId: user.id };

    const reports = await db.report.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        attachments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Get reports error:', error);
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
    const {
      category,
      description,
      location,
      latitude,
      longitude,
      anonymous,
      severity,
    } = body;

    if (!category || !description) {
      return NextResponse.json(
        { error: 'Category and description are required' },
        { status: 400 }
      );
    }

    const report = await db.report.create({
      data: {
        category,
        description,
        location: location || null,
        latitude: latitude || null,
        longitude: longitude || null,
        anonymous: anonymous ?? false,
        severity: severity || 'medium',
        userId: user.id,
      },
    });

    // Notify admins
    const adminRole = await db.role.findMany({
      where: { name: { in: ['SUPER_ADMIN', 'ADMIN', 'MODERATEUR'] } },
    });
    if (adminRole.length > 0) {
      const adminUsers = await db.user.findMany({
        where: { roleId: { in: adminRole.map((r) => r.id) } },
      });
      for (const admin of adminUsers) {
        await db.notification.create({
          data: {
            userId: admin.id,
            title: 'Nouveau signalement',
            message: `Un signalement de catégorie "${category}" a été créé`,
            type: 'report',
          },
        });
      }
    }

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    console.error('Create report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
