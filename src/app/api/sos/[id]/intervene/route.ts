import { NextResponse } from 'next/server';
import { turso } from '@/lib/db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

async function getAuthUser(request: Request) {
  const token = getTokenFromHeaders(request.headers);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const user = await turso.user.findUnique({ id: payload.userId as string });
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

    const roleName = user.role_name;
    const isAuthorized =
      roleName === 'SUPER_ADMIN' ||
      roleName === 'ADMIN' ||
      roleName === 'VOLONTAIRE' ||
      roleName === 'INTERVENANT_URGENCE';

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Not authorized to intervene' },
        { status: 403 }
      );
    }

    const alertResult = await turso.query(
      'SELECT * FROM sos_alerts WHERE id = ?',
      [id]
    );

    if (!alertResult.rows.length) {
      return NextResponse.json(
        { error: 'SOS alert not found' },
        { status: 404 }
      );
    }

    const alert = alertResult.rows[0] as any;

    const body = await request.json();
    const { status, notes } = body;

    const interventionId = await turso.insert('sos_interventions', {
      alert_id: id,
      responder_id: user.id,
      status: status || 'dispatched',
      notes: notes || null,
    });

    // Fetch the created intervention with responder info
    const intResult = await turso.query(
      `SELECT si.*, u.id as resp_user_id, u.name as resp_name
       FROM sos_interventions si
       LEFT JOIN users u ON si.responder_id = u.id
       WHERE si.id = ?`,
      [interventionId]
    );

    const i = intResult.rows[0] as any;
    const intervention = {
      id: i.id,
      alertId: i.alert_id,
      responderId: i.responder_id,
      status: i.status,
      role: i.role,
      notes: i.notes,
      respondedAt: i.responded_at,
      createdAt: i.created_at,
      updatedAt: i.updated_at,
      responder: i.resp_user_id ? { id: i.resp_user_id, name: i.resp_name } : null,
    };

    // Update alert status
    await turso.update('sos_alerts', { id }, { status: 'in_progress' });

    // Notify the alert creator (if not anonymous)
    if (alert.user_id) {
      await turso.insert('notifications', {
        user_id: alert.user_id,
        title: 'Intervention en cours',
        message: `${user.name} intervient sur votre alerte SOS`,
        type: 'sos',
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
