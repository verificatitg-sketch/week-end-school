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

    const notifications = await db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    const unreadCount = notifications.filter((n) => !n.read).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { notificationId, markAll } = body;

    if (markAll) {
      await db.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
      return NextResponse.json({ message: 'All notifications marked as read' });
    }

    if (!notificationId) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== user.id) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    await db.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    return NextResponse.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Update notification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
