import { NextResponse } from 'next/server';
import { supabaseAdmin, sb } from '@/lib/supabase';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * Convert snake_case string to camelCase
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Recursively map object keys from snake_case to camelCase
 */
function mapToCamelCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(mapToCamelCase);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[snakeToCamel(key)] = mapToCamelCase(value);
    }
    return result;
  }
  return obj;
}

export async function GET(request: Request) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const user = await sb.user.findUnique({ id: payload.userId as string });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const isAdmin =
      user.role?.name === 'SUPER_ADMIN' || user.role?.name === 'ADMIN';
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get counts in parallel
    const [
      usersCount,
      coursesCount,
      enrollmentsCount,
      opportunitiesCount,
      sosAlertsCount,
      reportsCount,
      certificatesCount,
      mentorsCount,
      communityPostsCount,
    ] = await Promise.all([
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('courses').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('enrollments').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('opportunities').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('sos_alerts').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('reports').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('certificates').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('mentors').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('community_posts').select('*', { count: 'exact', head: true }),
    ]);

    // Get recent activity in parallel
    const [
      recentUsersResult,
      recentEnrollmentsResult,
      recentSosAlertsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('id, name, email, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      supabaseAdmin
        .from('enrollments')
        .select('*, user:users(name), course:courses(title)')
        .order('enrolled_at', { ascending: false })
        .limit(5),
      supabaseAdmin
        .from('sos_alerts')
        .select('*, user:users(name)')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    // Get user role distribution
    const { data: allRolesRaw } = await supabaseAdmin
      .from('users')
      .select('role:roles(name)');

    const roleDistribution: Record<string, number> = {};
    for (const u of (allRolesRaw || [])) {
      const roleName = (u.role as { name: string } | null)?.name || 'NO_ROLE';
      roleDistribution[roleName] = (roleDistribution[roleName] || 0) + 1;
    }

    // Get SOS alert status distribution
    const { data: allSosAlertsRaw } = await supabaseAdmin
      .from('sos_alerts')
      .select('status');

    const sosStatusDistribution: Record<string, number> = {};
    for (const a of (allSosAlertsRaw || [])) {
      sosStatusDistribution[a.status] =
        (sosStatusDistribution[a.status] || 0) + 1;
    }

    return NextResponse.json({
      stats: {
        users: usersCount.count || 0,
        courses: coursesCount.count || 0,
        enrollments: enrollmentsCount.count || 0,
        opportunities: opportunitiesCount.count || 0,
        sosAlerts: sosAlertsCount.count || 0,
        reports: reportsCount.count || 0,
        certificates: certificatesCount.count || 0,
        mentors: mentorsCount.count || 0,
        communityPosts: communityPostsCount.count || 0,
      },
      recentActivity: {
        users: (recentUsersResult.data || []).map((u: unknown) => mapToCamelCase(u)),
        enrollments: (recentEnrollmentsResult.data || []).map((e: unknown) => mapToCamelCase(e)),
        sosAlerts: (recentSosAlertsResult.data || []).map((a: unknown) => mapToCamelCase(a)),
      },
      distributions: {
        roles: roleDistribution,
        sosStatus: sosStatusDistribution,
      },
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
