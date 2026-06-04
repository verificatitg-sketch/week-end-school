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

export async function GET(request: Request) {
  try {
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
      // Regular users can see their own alerts
      const { data: alerts, error } = await supabaseAdmin
        .from('sos_alerts')
        .select('*, interventions:sos_interventions(*, responder:users(id, name))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (alerts || []).map(mapAlert);
      return NextResponse.json({ alerts: mapped });
    }

    // Admin view - all alerts with full details
    const { data: alerts, error } = await supabaseAdmin
      .from('sos_alerts')
      .select('*, user:users(id, name, phone, location), interventions:sos_interventions(*, responder:users(id, name)), gpsUpdates:sos_gps_updates(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get call logs separately (can't do 3+ level nesting)
    const alertIds = (alerts || []).map((a: any) => a.id);

    let callLogsMap: Record<string, any[]> = {};
    if (alertIds.length > 0) {
      const { data: callLogs } = await supabaseAdmin
        .from('sos_call_logs')
        .select('*')
        .in('alert_id', alertIds)
        .order('created_at', { ascending: false });

      for (const cl of (callLogs || [])) {
        if (!callLogsMap[cl.alert_id]) callLogsMap[cl.alert_id] = [];
        callLogsMap[cl.alert_id].push(cl);
      }
    }

    const mapped = (alerts || []).map((a: any) => ({
      ...mapAlert(a),
      callLogs: (callLogsMap[a.id] || []).map((cl: any) => ({
        id: cl.id,
        alertId: cl.alert_id,
        action: cl.action,
        actorId: cl.actor_id,
        details: cl.details,
        createdAt: cl.created_at,
      })),
    }));

    return NextResponse.json({ alerts: mapped });
  } catch (error) {
    console.error('Get SOS alerts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    const body = await request.json();
    const {
      latitude, longitude, address, urgency, urgencyLevel,
      silentMode, silent, description, callerPhone, callerName,
      batteryLevel, isCharging, networkStatus, connectionType,
      sessionId, autoTriggered, isAnonymous, offlineStored,
    } = body;

    const effectiveUrgency = urgency || urgencyLevel || 'critical';
    const effectiveSilent = silentMode ?? silent ?? false;

    // SOS alerts can be sent without authentication for emergency access
    const isAnon = isAnonymous ?? !user;

    const { data: alert, error } = await supabaseAdmin
      .from('sos_alerts')
      .insert({
        user_id: user?.id || null,
        latitude: latitude || null,
        longitude: longitude || null,
        address: address || null,
        urgency_level: effectiveUrgency,
        silent_mode: effectiveSilent,
        description: description || null,
        is_anonymous: isAnon,
        caller_phone: callerPhone || user?.phone || null,
        caller_name: callerName || user?.name || null,
        battery_level: batteryLevel || null,
        is_charging: isCharging ?? null,
        network_status: networkStatus || null,
        connection_type: connectionType || null,
        session_id: sessionId || null,
        auto_triggered: autoTriggered ?? false,
        offline_stored: offlineStored ?? false,
        status: 'received',
      })
      .select()
      .single();

    if (error) throw error;

    // Log the call start
    await supabaseAdmin.from('sos_call_logs').insert({
      alert_id: alert.id,
      action: 'call_started',
      details: JSON.stringify({
        urgency: effectiveUrgency,
        autoTriggered: autoTriggered || false,
        anonymous: !user,
        offlineStored: offlineStored || false,
      }),
    });

    // If battery or network data was provided, log it
    if (batteryLevel || networkStatus) {
      await supabaseAdmin.from('sos_call_logs').insert({
        alert_id: alert.id,
        action: 'device_data',
        details: JSON.stringify({
          batteryLevel,
          isCharging,
          networkStatus,
          connectionType,
        }),
      });
    }

    // Auto-assign operator - find first available admin/emergency responder
    const { data: emergencyRoles } = await supabaseAdmin
      .from('roles')
      .select('id')
      .in('name', ['SUPER_ADMIN', 'ADMIN', 'INTERVENANT_URGENCE']);

    if (emergencyRoles && emergencyRoles.length > 0) {
      const roleIds = emergencyRoles.map((r: any) => r.id);

      const { data: responders } = await supabaseAdmin
        .from('users')
        .select('id, name')
        .in('role_id', roleIds)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (responders && responders.length > 0) {
        const primaryResponder = responders[0];
        const fallbackResponder = responders.length > 1 ? responders[1] : null;

        // Update alert with assigned operators
        await supabaseAdmin
          .from('sos_alerts')
          .update({
            assigned_admin_id: primaryResponder.id,
            fallback_admin_id: fallbackResponder?.id || null,
          })
          .eq('id', alert.id);

        // Create primary intervention
        await supabaseAdmin.from('sos_interventions').insert({
          alert_id: alert.id,
          responder_id: primaryResponder.id,
          status: 'dispatched',
          role: 'primary',
        });

        // Create fallback intervention if available
        if (fallbackResponder) {
          await supabaseAdmin.from('sos_interventions').insert({
            alert_id: alert.id,
            responder_id: fallbackResponder.id,
            status: 'dispatched',
            role: 'fallback',
          });
        }

        // Log operator assignment
        await supabaseAdmin.from('sos_call_logs').insert({
          alert_id: alert.id,
          action: 'operator_assigned',
          actor_id: primaryResponder.id,
          details: JSON.stringify({
            primaryOperator: primaryResponder.name,
            fallbackOperator: fallbackResponder?.name || null,
          }),
        });

        // Notify the PRIMARY operator only
        await supabaseAdmin.from('notifications').insert({
          user_id: primaryResponder.id,
          title: '🚨 ALERTE SOS - VOUS ÊTES ASSIGNÉ',
          message: `Alerte SOS${user ? ` de ${user.name}` : ' (anonyme)'}${effectiveUrgency === 'critical' ? ' - URGENCE CRITIQUE' : ''}${latitude ? ` - Position: ${latitude}, ${longitude}` : ''}${address ? ` - ${address}` : ''}${autoTriggered ? ' - DÉCLENCHÉE AUTO' : ''}`,
          type: 'sos',
        });
      }
    }

    // If offline stored alert, mark sync time
    if (offlineStored) {
      await supabaseAdmin
        .from('sos_alerts')
        .update({ synced_at: new Date().toISOString() })
        .eq('id', alert.id);
    }

    return NextResponse.json({ alert: mapAlert(alert) }, { status: 201 });
  } catch (error) {
    console.error('Create SOS alert error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function mapAlert(a: any) {
  return {
    id: a.id,
    userId: a.user_id,
    latitude: a.latitude,
    longitude: a.longitude,
    address: a.address,
    urgencyLevel: a.urgency_level,
    status: a.status,
    silentMode: a.silent_mode,
    description: a.description,
    callerPhone: a.caller_phone,
    callerName: a.caller_name,
    isAnonymous: a.is_anonymous,
    batteryLevel: a.battery_level,
    isCharging: a.is_charging,
    networkStatus: a.network_status,
    connectionType: a.connection_type,
    sessionId: a.session_id,
    assignedAdminId: a.assigned_admin_id,
    fallbackAdminId: a.fallback_admin_id,
    callId: a.call_id,
    escalationLevel: a.escalation_level,
    autoTriggered: a.auto_triggered,
    offlineStored: a.offline_stored,
    syncedAt: a.synced_at,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
    user: a.user,
    interventions: (a.interventions || []).map((i: any) => ({
      id: i.id,
      alertId: i.alert_id,
      responderId: i.responder_id,
      status: i.status,
      role: i.role,
      notes: i.notes,
      respondedAt: i.responded_at,
      createdAt: i.created_at,
      updatedAt: i.updated_at,
      responder: i.responder,
    })),
    gpsUpdates: (a.gpsUpdates || []).map((g: any) => ({
      id: g.id,
      alertId: g.alert_id,
      latitude: g.latitude,
      longitude: g.longitude,
      accuracy: g.accuracy,
      speed: g.speed,
      timestamp: g.timestamp,
    })),
  };
}
