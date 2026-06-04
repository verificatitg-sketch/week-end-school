import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/sos/admins - Public endpoint to get available admin users for SOS
// This is intentionally public so unauthenticated users (on login page) can see admin info
export async function GET() {
  try {
    const adminRoles = await db.role.findMany({
      where: {
        name: { in: ['SUPER_ADMIN', 'ADMIN', 'INTERVENANT_URGENCE'] },
      },
    });

    const admins = await db.user.findMany({
      where: {
        roleId: { in: adminRoles.map((r) => r.id) },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        location: true,
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      admins: admins.map((a) => ({
        id: a.id,
        name: a.name,
        phone: a.phone || '',
        email: a.email,
        location: a.location || '',
        role: (a.role as { name: string })?.name || 'ADMIN',
      })),
    });
  } catch (error) {
    console.error('Get SOS admins error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
