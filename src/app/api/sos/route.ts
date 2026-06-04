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

export async function GET(request: Request) {
  try {
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
      // Regular users can see their own alerts
      const alertsResult = await turso.query(
        `SELECT * FROM sos_alerts WHERE user_id = ? ORDER BY created_at DESC`,
        [user.id]
      );

      // Get interventions for these alerts
      const alertIds = alertsResult.rows.map((a: any) => a.id);
      let interventionsMap: Record<string, any[]> = {};

      if (alertIds.length > 0) {
        const placeholders = alertIds.map(() => '?').join(',');
        const intResult = await turso.query(
          `SELECT si.*, u.id as resp_user_id, u.name as resp_name
           FROM sos_interventions si
           LEFT JOIN users u ON si.responder_id = u.id
           WHERE si.alert_id IN (${placeholders})`,
          alertIds
        );

        for (const i of intResult.rows) {
          const intv = i as any;
          if (!interventionsMap[intv.alert_id]) interventionsMap[intv.alert_id] = [];
          interventionsMap[intv.alert_id].push(intv);
        }
      }

      const mapped = alertsResult.rows.map((a: any) => ({
        ...mapAlert(a),
        interventions: (interventionsMap[a.id] || []).map(mapIntervention),
      }));

      return NextResponse.json({ alerts: mapped });
    }

    // Admin view - all alerts with full details
    const alertsResult = await turso.query(
      `SELECT sa.*, u.id as alert_user_id, u.name as alert_user_name, u.phone as alert_user_phone, u.location as alert_user_location
       FROM sos_alerts sa
       LEFT JOIN users u ON sa.user_id = u.id
       ORDER BY sa.created_at DESC`
    );

    const alertIds = alertsResult.rows.map((a: any) => a.id);

    // Get interventions
    let interventionsMap: Record<string, any[]> = {};
    // Get GPS updates
    let gpsUpdatesMap: Record<string, any[]> = {};
    // Get call logs
    let callLogsMap: Record<string, any[]> = {};

    if (alertIds.length > 0) {
      const placeholders = alertIds.map(() => '?').join(',');

      const [intResult, gpsResult, callResult] = await Promise.all([
        turso.query(
          `SELECT si.*, u.id as resp_user_id, u.name as resp_name
           FROM sos_interventions si
           LEFT JOIN users u ON si.responder_id = u.id
           WHERE si.alert_id IN (${placeholders})`,
          alertIds
        ),
        turso.query(
          `SELECT * FROM sos_gps_updates WHERE alert_id IN (${placeholders})`,
          alertIds
        ),
        turso.query(
          `SELECT * FROM sos_call_logs WHERE alert_id IN (${placeholders}) ORDER BY created_at DESC`,
          alertIds
        ),
      ]);

      for (const i of intResult.rows) {
        const intv = i as any;
        if (!interventionsMap[intv.alert_id]) interventionsMap[intv.alert_id] = [];
        interventionsMap[intv.alert_id].push(intv);
      }

      for (const g of gpsResult.rows) {
        const gps = g as any;
        if (!gpsUpdatesMap[gps.alert_id]) gpsUpdatesMap[gps.alert_id] = [];
        gpsUpdatesMap[gps.alert_id].push(gps);
      }

      for (const cl of callResult.rows) {
        const log = cl as any;
        if (!callLogsMap[log.alert_id]) callLogsMap[log.alert_id] = [];
        callLogsMap[log.alert_id].push(log);
      }
    }

    const mapped = alertsResult.rows.map((a: any) => ({
      ...mapAlert(a),
      user: a.alert_user_id ? {
        id: a.alert_user_id,
        name: a.alert_user_name,
        phone: a.alert_user_phone,
        location: a.alert_user_location,
      } : null,
      interventions: (interventionsMap[a.id] || []).map(mapIntervention),
      gpsUpdates: (gpsUpdatesMap[a.id] || []).map(mapGpsUpdate),
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

    const alertId = await turso.insert('sos_alerts', {
      user_id: user?.id || null,
      latitude: latitude || null,
      longitude: longitude || null,
      address: address || null,
      urgency_level: effectiveUrgency,
      silent_mode: effectiveSilent ? 1 : 0,
      description: description || null,
      is_anonymous: isAnon ? 1 : 0,
      caller_phone: callerPhone || user?.phone || null,
      caller_name: callerName || user?.name || null,
      battery_level: batteryLevel || null,
      is_charging: isCharging != null ? (isCharging ? 1 : 0) : null,
      network_status: networkStatus || null,
      connection_type: connectionType || null,
      session_id: sessionId || null,
      auto_triggered: autoTriggered ? 1 : 0,
      offline_stored: offlineStored ? 1 : 0,
      status: 'received',
    });

    // Fetch the created alert
    const alertResult = await turso.query(
      'SELECT * FROM sos_alerts WHERE id = ?',
      [alertId]
    );
    const alert = alertResult.rows[0] as any;

    // Log the call start
    await turso.insert('sos_call_logs', {
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
      await turso.insert('sos_call_logs', {
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
    const emergencyRolesResult = await turso.query(
      `SELECT id FROM roles WHERE name IN ('SUPER_ADMIN', 'ADMIN', 'INTERVENANT_URGENCE')`
    );

    if (emergencyRolesResult.rows.length > 0) {
      const roleIds = emergencyRolesResult.rows.map((r: any) => r.id);
      const placeholders = roleIds.map(() => '?').join(',');

      const respondersResult = await turso.query(
        `SELECT id, name FROM users WHERE role_id IN (${placeholders}) AND is_active = 1 ORDER BY created_at ASC`,
        roleIds
      );

      if (respondersResult.rows.length > 0) {
        const primaryResponder = respondersResult.rows[0] as any;
        const fallbackResponder = respondersResult.rows.length > 1 ? (respondersResult.rows[1] as any) : null;

        // Update alert with assigned operators
        await turso.update('sos_alerts', { id: alert.id }, {
          assigned_admin_id: primaryResponder.id,
          fallback_admin_id: fallbackResponder?.id || null,
        });

        // Create primary intervention
        await turso.insert('sos_interventions', {
          alert_id: alert.id,
          responder_id: primaryResponder.id,
          status: 'dispatched',
          role: 'primary',
        });

        // Create fallback intervention if available
        if (fallbackResponder) {
          await turso.insert('sos_interventions', {
            alert_id: alert.id,
            responder_id: fallbackResponder.id,
            status: 'dispatched',
            role: 'fallback',
          });
        }

        // Log operator assignment
        await turso.insert('sos_call_logs', {
          alert_id: alert.id,
          action: 'operator_assigned',
          actor_id: primaryResponder.id,
          details: JSON.stringify({
            primaryOperator: primaryResponder.name,
            fallbackOperator: fallbackResponder?.name || null,
          }),
        });

        // Notify the PRIMARY operator only
        await turso.insert('notifications', {
          user_id: primaryResponder.id,
          title: '🚨 ALERTE SOS - VOUS ÊTES ASSIGNÉ',
          message: `Alerte SOS${user ? ` de ${user.name}` : ' (anonyme)'}${effectiveUrgency === 'critical' ? ' - URGENCE CRITIQUE' : ''}${latitude ? ` - Position: ${latitude}, ${longitude}` : ''}${address ? ` - ${address}` : ''}${autoTriggered ? ' - DÉCLENCHÉE AUTO' : ''}`,
          type: 'sos',
        });
      }
    }

    // If offline stored alert, mark sync time
    if (offlineStored) {
      await turso.update('sos_alerts', { id: alert.id }, {
        synced_at: new Date().toISOString(),
      });
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
    silentMode: !!a.silent_mode,
    description: a.description,
    callerPhone: a.caller_phone,
    callerName: a.caller_name,
    isAnonymous: !!a.is_anonymous,
    batteryLevel: a.battery_level,
    isCharging: a.is_charging != null ? !!a.is_charging : null,
    networkStatus: a.network_status,
    connectionType: a.connection_type,
    sessionId: a.session_id,
    assignedAdminId: a.assigned_admin_id,
    fallbackAdminId: a.fallback_admin_id,
    callId: a.call_id,
    escalationLevel: a.escalation_level,
    autoTriggered: !!a.auto_triggered,
    offlineStored: !!a.offline_stored,
    syncedAt: a.synced_at,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
    user: a.user || null,
    interventions: [],
    gpsUpdates: [],
  };
}

function mapIntervention(i: any) {
  return {
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
}

function mapGpsUpdate(g: any) {
  return {
    id: g.id,
    alertId: g.alert_id,
    latitude: g.latitude,
    longitude: g.longitude,
    accuracy: g.accuracy,
    speed: g.speed,
    timestamp: g.timestamp,
  };
}
