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
    const type = searchParams.get('type');

    const where: Record<string, unknown> = { published: true };
    if (type) {
      where.type = type;
    }

    const opportunities = await db.opportunity.findMany({
      where,
      include: {
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ opportunities });
  } catch (error) {
    console.error('Get opportunities error:', error);
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
      user.role?.name === 'SUPER_ADMIN' || user.role?.name === 'ADMIN';
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      type,
      organization,
      location,
      latitude,
      longitude,
      deadline,
      salary,
      requirements,
      contactEmail,
      contactPhone,
      url,
    } = body;

    if (!title || !description || !type) {
      return NextResponse.json(
        { error: 'Title, description, and type are required' },
        { status: 400 }
      );
    }

    const opportunity = await db.opportunity.create({
      data: {
        title,
        description,
        type,
        organization: organization || null,
        location: location || null,
        latitude: latitude || null,
        longitude: longitude || null,
        deadline: deadline || null,
        salary: salary || null,
        requirements: requirements || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        url: url || null,
      },
    });

    return NextResponse.json({ opportunity }, { status: 201 });
  } catch (error) {
    console.error('Create opportunity error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
