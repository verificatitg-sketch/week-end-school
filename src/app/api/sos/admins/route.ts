import { NextResponse } from 'next/server';
import { turso } from '@/lib/db';

// GET /api/sos/admins - Public endpoint to get available admin users for SOS
// This is intentionally public so unauthenticated users (on login page) can see admin info
export async function GET() {
  try {
    // Find admin/emergency roles
    const rolesResult = await turso.query(
      `SELECT id, name FROM roles WHERE name IN ('SUPER_ADMIN', 'ADMIN', 'INTERVENANT_URGENCE')`
    );

    if (!rolesResult.rows.length) {
      return NextResponse.json({ admins: [] });
    }

    const roleIds = rolesResult.rows.map((r: any) => r.id);
    const placeholders = roleIds.map(() => '?').join(',');

    const adminsResult = await turso.query(
      `SELECT u.id, u.name, u.phone, u.email, u.location, r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.role_id IN (${placeholders}) AND u.is_active = 1`,
      roleIds
    );

    return NextResponse.json({
      admins: adminsResult.rows.map((a: any) => ({
        id: a.id,
        name: a.name,
        phone: a.phone || '',
        email: a.email,
        location: a.location || '',
        role: a.role_name || 'ADMIN',
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
