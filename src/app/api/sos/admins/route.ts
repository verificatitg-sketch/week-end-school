import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/sos/admins - Public endpoint to get available admin users for SOS
// This is intentionally public so unauthenticated users (on login page) can see admin info
export async function GET() {
  try {
    // Find admin/emergency roles
    const { data: adminRoles, error: rolesError } = await supabaseAdmin
      .from('roles')
      .select('id, name')
      .in('name', ['SUPER_ADMIN', 'ADMIN', 'INTERVENANT_URGENCE']);

    if (rolesError) throw rolesError;

    if (!adminRoles || adminRoles.length === 0) {
      return NextResponse.json({ admins: [] });
    }

    const roleIds = adminRoles.map((r: any) => r.id);

    const { data: admins, error } = await supabaseAdmin
      .from('users')
      .select('id, name, phone, email, location, role:roles(name)')
      .in('role_id', roleIds)
      .eq('is_active', true);

    if (error) throw error;

    return NextResponse.json({
      admins: (admins || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        phone: a.phone || '',
        email: a.email,
        location: a.location || '',
        role: a.role?.name || 'ADMIN',
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
