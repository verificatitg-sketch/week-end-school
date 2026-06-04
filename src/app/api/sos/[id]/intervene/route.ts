import { NextResponse } from 'next/server';
import { supabaseAdmin, sb } from '@/lib/supabase';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

async function getAuthUser(request: Request) {
  const token = getTokenFromHeaders(request.headers);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const user = await sb.user.findUnique({ id: payload.userId as string });
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

    const { data: alert } = await supabaseAdmin
      .from('sos_alerts')
      .select('*')
      .eq('id', id)
      .single();

    if (!alert) {
      return NextResponse.json(
        { error: 'SOS alert not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { status, notes } = body;

    const { data: intervention, error } = await supabaseAdmin
      .from('sos_interventions')
      .insert({
        alert_id: id,
        responder_id: user.id,
        status: status || 'dispatched',
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Update alert status
    await supabaseAdmin
      .from('sos_alerts')
      .update({ status: 'in_progress' })
      .eq('id', id);

    // Notify the alert creator (if not anonymous)
    if (alert.user_id) {
      await supabaseAdmin.from('notifications').insert({
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
