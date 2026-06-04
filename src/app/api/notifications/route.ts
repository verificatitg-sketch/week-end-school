import { NextResponse } from 'next/server';
import { turso } from '@/lib/db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

async function getAuthUser(request: Request) {
  const token = getTokenFromHeaders(request.headers);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const { db } = await import('@/lib/db');
  const user = await db.user.findUnique({ id: payload.userId as string });
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

    const result = await turso.query(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`,
      [user.id]
    );

    const notifications = result.rows;

    const mapped = (notifications || []).map((n: any) => ({
      id: n.id,
      userId: n.user_id,
      title: n.title,
      message: n.message,
      type: n.type,
      read: !!n.read,
      link: n.link,
      createdAt: n.created_at,
    }));

    const unreadCount = mapped.filter((n: any) => !n.read).length;

    return NextResponse.json({ notifications: mapped, unreadCount });
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
      await turso.query(
        `UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0`,
        [user.id]
      );

      return NextResponse.json({ message: 'All notifications marked as read' });
    }

    if (!notificationId) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    const notification = await turso.findById('notifications', notificationId);

    if (!notification || (notification as any).user_id !== user.id) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    await turso.query(
      `UPDATE notifications SET read = 1 WHERE id = ?`,
      [notificationId]
    );

    return NextResponse.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Update notification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
