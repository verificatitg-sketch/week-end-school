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

    const isAuthorized =
      user.role?.name === 'SUPER_ADMIN' ||
      user.role?.name === 'ADMIN' ||
      user.role?.name === 'VOLONTAIRE' ||
      user.role?.name === 'INTERVENANT_URGENCE';

    if (!isAuthorized) {
      // Regular users can see their own alerts
      const alerts = await db.sosAlert.findMany({
        where: { userId: user.id },
        include: {
          interventions: {
            include: {
              responder: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ alerts });
    }

    const alerts = await db.sosAlert.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            location: true,
          },
        },
        interventions: {
          include: {
            responder: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        gpsUpdates: {
          orderBy: { timestamp: 'desc' },
          take: 10,
        },
        callLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ alerts });
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

    const alert = await db.sosAlert.create({
      data: {
        userId: user?.id || null,
        latitude: latitude || null,
        longitude: longitude || null,
        address: address || null,
        urgencyLevel: effectiveUrgency,
        silentMode: effectiveSilent,
        description: description || null,
        isAnonymous: isAnon,
        callerPhone: callerPhone || user?.phone || null,
        callerName: callerName || user?.name || null,
        batteryLevel: batteryLevel || null,
        isCharging: isCharging ?? undefined,
        networkStatus: networkStatus || null,
        connectionType: connectionType || null,
        sessionId: sessionId || null,
        autoTriggered: autoTriggered ?? false,
        offlineStored: offlineStored ?? false,
        status: 'received',
      },
    });

    // Log the call start
    await db.sosCallLog.create({
      data: {
        alertId: alert.id,
        action: 'call_started',
        details: JSON.stringify({
          urgency: effectiveUrgency,
          autoTriggered: autoTriggered || false,
          anonymous: !user,
          offlineStored: offlineStored || false,
        }),
      },
    });

    // If battery or network data was provided, log it
    if (batteryLevel || networkStatus) {
      await db.sosCallLog.create({
        data: {
          alertId: alert.id,
          action: 'device_data',
          details: JSON.stringify({
            batteryLevel,
            isCharging,
            networkStatus,
            connectionType,
          }),
        },
      });
    }

    // Auto-assign operator (find first available admin/emergency responder)
    const emergencyRoles = await db.role.findMany({
      where: { name: { in: ['SUPER_ADMIN', 'ADMIN', 'INTERVENANT_URGENCE'] } },
    });

    if (emergencyRoles.length > 0) {
      const responders = await db.user.findMany({
        where: { roleId: { in: emergencyRoles.map((r) => r.id) }, isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      // Assign primary and fallback operators
      if (responders.length > 0) {
        const primaryResponder = responders[0];
        const fallbackResponder = responders.length > 1 ? responders[1] : null;

        await db.sosAlert.update({
          where: { id: alert.id },
          data: {
            assignedAdminId: primaryResponder.id,
            fallbackAdminId: fallbackResponder?.id || null,
          },
        });

        // Create primary intervention
        await db.sosIntervention.create({
          data: {
            alertId: alert.id,
            responderId: primaryResponder.id,
            status: 'dispatched',
            role: 'primary',
          },
        });

        // Create fallback intervention if available
        if (fallbackResponder) {
          await db.sosIntervention.create({
            data: {
              alertId: alert.id,
              responderId: fallbackResponder.id,
              status: 'dispatched',
              role: 'fallback',
            },
          });
        }

        // Log operator assignment
        await db.sosCallLog.create({
          data: {
            alertId: alert.id,
            action: 'operator_assigned',
            actorId: primaryResponder.id,
            details: JSON.stringify({
              primaryOperator: primaryResponder.name,
              fallbackOperator: fallbackResponder?.name || null,
            }),
          },
        });

        // Notify the PRIMARY operator only (not broadcast!)
        await db.notification.create({
          data: {
            userId: primaryResponder.id,
            title: '🚨 ALERTE SOS - VOUS ÊTES ASSIGNÉ',
            message: `Alerte SOS${user ? ` de ${user.name}` : ' (anonyme)'}${effectiveUrgency === 'critical' ? ' - URGENCE CRITIQUE' : ''}${latitude ? ` - Position: ${latitude}, ${longitude}` : ''}${address ? ` - ${address}` : ''}${autoTriggered ? ' - DÉCLENCHÉE AUTO' : ''}`,
            type: 'sos',
          },
        });
      }
    }

    // If offline stored alert, mark sync time
    if (offlineStored) {
      await db.sosAlert.update({
        where: { id: alert.id },
        data: { syncedAt: new Date() },
      });
    }

    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    console.error('Create SOS alert error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
