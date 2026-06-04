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

export async function GET() {
  try {
    const mentors = await db.mentor.findMany({
      where: { acceptRequests: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            bio: true,
            location: true,
          },
        },
      },
      orderBy: { rating: 'desc' },
    });

    return NextResponse.json({ mentors });
  } catch (error) {
    console.error('Get mentors error:', error);
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

    // Check if already a mentor
    const existing = await db.mentor.findUnique({
      where: { userId: user.id },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'You are already registered as a mentor' },
        { status: 409 }
      );
    }

    const body = await request.json();
    const { expertise, availability, experience } = body;

    if (!expertise || !availability) {
      return NextResponse.json(
        { error: 'Expertise and availability are required' },
        { status: 400 }
      );
    }

    // Update role to MENTOR if not already
    const mentorRole = await db.role.upsert({
      where: { name: 'MENTOR' },
      update: {},
      create: { name: 'MENTOR', description: 'Mentor role' },
    });

    await db.user.update({
      where: { id: user.id },
      data: { roleId: mentorRole.id },
    });

    const mentor = await db.mentor.create({
      data: {
        userId: user.id,
        expertise,
        availability,
        experience: experience || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            bio: true,
          },
        },
      },
    });

    return NextResponse.json({ mentor }, { status: 201 });
  } catch (error) {
    console.error('Create mentor error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
