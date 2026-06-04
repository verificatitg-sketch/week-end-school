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

    const isAdmin =
      user.role?.name === 'SUPER_ADMIN' ||
      user.role?.name === 'ADMIN' ||
      user.role?.name === 'MODERATEUR';

    let query = supabaseAdmin
      .from('reports')
      .select('*, user:users(id, name, email, avatar), attachments:report_attachments(*)')
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('user_id', user.id);
    }

    const { data: reports, error } = await query;
    if (error) throw error;

    const mapped = (reports || []).map((r: any) => ({
      id: r.id,
      category: r.category,
      description: r.description,
      location: r.location,
      latitude: r.latitude,
      longitude: r.longitude,
      anonymous: r.anonymous,
      status: r.status,
      severity: r.severity,
      userId: r.user_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      user: r.user,
      attachments: r.attachments || [],
    }));

    return NextResponse.json({ reports: mapped });
  } catch (error) {
    console.error('Get reports error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      category, description, location, latitude, longitude,
      anonymous, severity,
    } = body;

    if (!category || !description) {
      return NextResponse.json(
        { error: 'Category and description are required' },
        { status: 400 }
      );
    }

    const { data: report, error } = await supabaseAdmin
      .from('reports')
      .insert({
        category,
        description,
        location: location || null,
        latitude: latitude || null,
        longitude: longitude || null,
        anonymous: anonymous ?? false,
        severity: severity || 'medium',
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Notify admins
    const { data: adminRoles } = await supabaseAdmin
      .from('roles')
      .select('id')
      .in('name', ['SUPER_ADMIN', 'ADMIN', 'MODERATEUR']);

    if (adminRoles && adminRoles.length > 0) {
      const roleIds = adminRoles.map((r: any) => r.id);
      const { data: adminUsers } = await supabaseAdmin
        .from('users')
        .select('id')
        .in('role_id', roleIds);

      if (adminUsers) {
        const notifications = adminUsers.map((admin: any) => ({
          user_id: admin.id,
          title: 'Nouveau signalement',
          message: `Un signalement de catégorie "${category}" a été créé`,
          type: 'report',
        }));

        await supabaseAdmin.from('notifications').insert(notifications);
      }
    }

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    console.error('Create report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
