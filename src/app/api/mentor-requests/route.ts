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

    const requests = await db.mentorRequest.findMany({
      where: { menteeId: user.id },
      include: {
        mentor: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Get mentor requests error:', error);
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
    const { mentorId, message } = body;

    if (!mentorId) {
      return NextResponse.json(
        { error: 'Mentor ID is required' },
        { status: 400 }
      );
    }

    // Check mentor exists and accepts requests
    const mentor = await db.mentor.findUnique({
      where: { id: mentorId },
    });

    if (!mentor || !mentor.acceptRequests) {
      return NextResponse.json(
        { error: 'Mentor not available for requests' },
        { status: 404 }
      );
    }

    // Check if request already exists
    const existing = await db.mentorRequest.findFirst({
      where: {
        menteeId: user.id,
        mentorId,
        status: 'pending',
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'You already have a pending request to this mentor' },
        { status: 409 }
      );
    }

    const mentorRequest = await db.mentorRequest.create({
      data: {
        menteeId: user.id,
        mentorId,
        message: message || null,
      },
    });

    // Notify the mentor
    const mentorUser = await db.user.findUnique({
      where: { id: mentor.userId },
    });
    if (mentorUser) {
      await db.notification.create({
        data: {
          userId: mentor.userId,
          title: 'Nouvelle demande de mentorat',
          message: `${user.name} vous a envoyé une demande de mentorat`,
          type: 'mentorship',
        },
      });
    }

    return NextResponse.json({ request: mentorRequest }, { status: 201 });
  } catch (error) {
    console.error('Create mentor request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
