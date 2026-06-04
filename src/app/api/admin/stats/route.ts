import { NextResponse } from 'next/server';
import { turso, db } from '@/lib/db';
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

    const user = await turso.user.findUnique({ id: payload.userId as string });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const isAdmin =
      user.role_name === 'SUPER_ADMIN' || user.role_name === 'ADMIN';
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get counts in parallel
    const [
      usersCountRes,
      coursesCountRes,
      enrollmentsCountRes,
      opportunitiesCountRes,
      sosAlertsCountRes,
      reportsCountRes,
      certificatesCountRes,
      mentorsCountRes,
      communityPostsCountRes,
    ] = await Promise.all([
      db.execute({ sql: 'SELECT COUNT(*) as count FROM users', args: [] }),
      db.execute({ sql: 'SELECT COUNT(*) as count FROM courses', args: [] }),
      db.execute({ sql: 'SELECT COUNT(*) as count FROM enrollments', args: [] }),
      db.execute({ sql: 'SELECT COUNT(*) as count FROM opportunities', args: [] }),
      db.execute({ sql: 'SELECT COUNT(*) as count FROM sos_alerts', args: [] }),
      db.execute({ sql: 'SELECT COUNT(*) as count FROM reports', args: [] }),
      db.execute({ sql: 'SELECT COUNT(*) as count FROM certificates', args: [] }),
      db.execute({ sql: 'SELECT COUNT(*) as count FROM mentors', args: [] }),
      db.execute({ sql: 'SELECT COUNT(*) as count FROM community_posts', args: [] }),
    ]);

    // Get recent activity in parallel
    const [
      recentUsersResult,
      recentEnrollmentsResult,
      recentSosAlertsResult,
    ] = await Promise.all([
      db.execute({
        sql: 'SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT 5',
        args: [],
      }),
      db.execute({
        sql: `SELECT e.*, u.name as user_name, c.title as course_title
               FROM enrollments e
               LEFT JOIN users u ON e.user_id = u.id
               LEFT JOIN courses c ON e.course_id = c.id
               ORDER BY e.enrolled_at DESC LIMIT 5`,
        args: [],
      }),
      db.execute({
        sql: `SELECT s.*, u.name as user_name
               FROM sos_alerts s
               LEFT JOIN users u ON s.user_id = u.id
               ORDER BY s.created_at DESC LIMIT 5`,
        args: [],
      }),
    ]);

    // Map enrollment rows to include nested user/course objects matching the old format
    const recentEnrollments = recentEnrollmentsResult.rows.map((row) => {
      const obj = row as Record<string, unknown>;
      return {
        id: obj.id,
        user_id: obj.user_id,
        course_id: obj.course_id,
        progress: obj.progress,
        completed: obj.completed,
        enrolled_at: obj.enrolled_at,
        updated_at: obj.updated_at,
        user: obj.user_name ? { name: obj.user_name } : null,
        course: obj.course_title ? { title: obj.course_title } : null,
      };
    });

    // Map SOS alert rows to include nested user object matching the old format
    const recentSosAlerts = recentSosAlertsResult.rows.map((row) => {
      const obj = row as Record<string, unknown>;
      return {
        id: obj.id,
        user_id: obj.user_id,
        status: obj.status,
        created_at: obj.created_at,
        updated_at: obj.updated_at,
        user: obj.user_name ? { name: obj.user_name } : null,
      };
    });

    // Get user role distribution
    const roleDistResult = await db.execute({
      sql: `SELECT r.name as role_name, COUNT(*) as count
             FROM users u
             LEFT JOIN roles r ON u.role_id = r.id
             GROUP BY r.name`,
      args: [],
    });

    const roleDistribution: Record<string, number> = {};
    for (const row of roleDistResult.rows) {
      const r = row as Record<string, unknown>;
      const roleName = (r.role_name as string) || 'NO_ROLE';
      roleDistribution[roleName] = (r.count as number) || 0;
    }

    // Get SOS alert status distribution
    const sosStatusResult = await db.execute({
      sql: 'SELECT status, COUNT(*) as count FROM sos_alerts GROUP BY status',
      args: [],
    });

    const sosStatusDistribution: Record<string, number> = {};
    for (const row of sosStatusResult.rows) {
      const r = row as Record<string, unknown>;
      sosStatusDistribution[r.status as string] = (r.count as number) || 0;
    }

    return NextResponse.json({
      stats: {
        users: (usersCountRes.rows[0] as Record<string, unknown>)?.count || 0,
        courses: (coursesCountRes.rows[0] as Record<string, unknown>)?.count || 0,
        enrollments: (enrollmentsCountRes.rows[0] as Record<string, unknown>)?.count || 0,
        opportunities: (opportunitiesCountRes.rows[0] as Record<string, unknown>)?.count || 0,
        sosAlerts: (sosAlertsCountRes.rows[0] as Record<string, unknown>)?.count || 0,
        reports: (reportsCountRes.rows[0] as Record<string, unknown>)?.count || 0,
        certificates: (certificatesCountRes.rows[0] as Record<string, unknown>)?.count || 0,
        mentors: (mentorsCountRes.rows[0] as Record<string, unknown>)?.count || 0,
        communityPosts: (communityPostsCountRes.rows[0] as Record<string, unknown>)?.count || 0,
      },
      recentActivity: {
        users: recentUsersResult.rows.map((u) => mapToCamelCase(u)),
        enrollments: recentEnrollments.map((e) => mapToCamelCase(e)),
        sosAlerts: recentSosAlerts.map((a) => mapToCamelCase(a)),
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
