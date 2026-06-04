import { NextResponse } from 'next/server';
import { turso, db, mapUserToDb } from '@/lib/db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

async function getAuthUser(request: Request) {
  const token = getTokenFromHeaders(request.headers);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const user = await db.user.findUnique({ id: payload.userId as string });
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
      user.role_name === 'SUPER_ADMIN' ||
      user.role_name === 'ADMIN' ||
      user.role_name === 'MODERATEUR';

    let sql = `SELECT r.*, u.id as user_id, u.name as user_name, u.email as user_email, u.avatar as user_avatar
      FROM reports r
      LEFT JOIN users u ON r.user_id = u.id`;
    const args: unknown[] = [];

    if (!isAdmin) {
      sql += ' WHERE r.user_id = ?';
      args.push(user.id);
    }

    sql += ' ORDER BY r.created_at DESC';

    const result = await turso.query(sql, args);
    const reports = result.rows;

    // Fetch attachments for all reports
    const reportIds = (reports || []).map((r: any) => r.id);
    let attachmentsMap: Record<string, any[]> = {};

    if (reportIds.length > 0) {
      const placeholders = reportIds.map(() => '?').join(',');
      const attachResult = await turso.query(
        `SELECT * FROM report_attachments WHERE report_id IN (${placeholders})`,
        reportIds
      );
      for (const att of attachResult.rows as any[]) {
        if (!attachmentsMap[att.report_id]) {
          attachmentsMap[att.report_id] = [];
        }
        attachmentsMap[att.report_id].push(att);
      }
    }

    const mapped = (reports || []).map((r: any) => ({
      id: r.id,
      category: r.category,
      description: r.description,
      location: r.location,
      latitude: r.latitude,
      longitude: r.longitude,
      anonymous: !!r.anonymous,
      status: r.status,
      severity: r.severity,
      userId: r.user_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      user: r.user_id ? {
        id: r.user_id,
        name: r.user_name,
        email: r.user_email,
        avatar: r.user_avatar,
      } : null,
      attachments: attachmentsMap[r.id] || [],
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

    const insertData = mapUserToDb({
      category,
      description,
      location: location || null,
      latitude: latitude || null,
      longitude: longitude || null,
      anonymous: anonymous ?? false,
      severity: severity || 'medium',
      userId: user.id,
    });

    const id = await turso.insert('reports', insertData);
    const report = await turso.findById('reports', id);

    // Notify admins
    const adminRoles = await turso.query(
      `SELECT id FROM roles WHERE name IN ('SUPER_ADMIN', 'ADMIN', 'MODERATEUR')`
    );
    const roleIds = (adminRoles.rows as any[]).map((r: any) => r.id);

    if (roleIds.length > 0) {
      const placeholders = roleIds.map(() => '?').join(',');
      const adminUsers = await turso.query(
        `SELECT id FROM users WHERE role_id IN (${placeholders})`,
        roleIds
      );

      for (const admin of adminUsers.rows as any[]) {
        await turso.insert('notifications', {
          user_id: admin.id,
          title: 'Nouveau signalement',
          message: `Un signalement de catégorie "${category}" a été créé`,
          type: 'report',
        });
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
