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

export async function POST(
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
      user.role?.name === 'SUPER_ADMIN' ||
      user.role?.name === 'ADMIN' ||
      user.role?.name === 'VOLONTAIRE' ||
      user.role?.name === 'INTERVENANT_URGENCE';

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Not authorized to intervene' },
        { status: 403 }
      );
    }

    const alert = await db.sosAlert.findUnique({ where: { id } });
    if (!alert) {
      return NextResponse.json(
        { error: 'SOS alert not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { status, notes } = body;

    const intervention = await db.sosIntervention.create({
      data: {
        alertId: id,
        responderId: user.id,
        status: status || 'dispatched',
        notes: notes || null,
      },
    });

    // Update alert status
    await db.sosAlert.update({
      where: { id },
      data: { status: 'in_progress' },
    });

    // Notify the alert creator (if not anonymous)
    if (alert.userId) {
      await db.notification.create({
        data: {
          userId: alert.userId,
          title: 'Intervention en cours',
          message: `${user.name} intervient sur votre alerte SOS`,
          type: 'sos',
        },
      });
    }

    return NextResponse.json({ intervention }, { status: 201 });
  } catch (error) {
    console.error('Create intervention error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
