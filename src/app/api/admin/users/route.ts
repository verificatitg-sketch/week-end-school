import { NextResponse } from 'next/server';
import { turso, db, mapUserToDb, DbUser, mapUserToApi } from '@/lib/db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * Helper: Authenticate and authorize the request.
 * Returns the authenticated user (with role) or a NextResponse error.
 */
async function authenticateAdmin(
  headers: Headers,
  requireSuperAdmin = false
): Promise<{ user: DbUser } | NextResponse> {
  const token = getTokenFromHeaders(headers);
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

  const isSuperAdmin = user.role_name === 'SUPER_ADMIN';
  const isAdmin = isSuperAdmin || user.role_name === 'ADMIN';

  if (requireSuperAdmin && !isSuperAdmin) {
    return NextResponse.json(
      { error: 'Super admin access required' },
      { status: 403 }
    );
  }

  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    );
  }

  return { user };
}

/**
 * GET /api/admin/users
 * List users with search, role filter, and pagination.
 */
export async function GET(request: Request) {
  try {
    const authResult = await authenticateAdmin(request.headers);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    // If role filter specified, look up the role_id first
    let roleId: string | null = null;
    if (role) {
      const roleRecord = await turso.role.findUnique({ name: role });
      if (!roleRecord) {
        // Role doesn't exist, return empty results
        return NextResponse.json({
          users: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        });
      }
      roleId = roleRecord.id;
    }

    // Build WHERE conditions
    const conditions: string[] = [];
    const args: unknown[] = [];

    if (search) {
      conditions.push('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
      args.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (roleId) {
      conditions.push('u.role_id = ?');
      args.push(roleId);
    }

    const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

    // Count total
    const countRes = await db.execute({
      sql: `SELECT COUNT(*) as count FROM users u${whereClause}`,
      args,
    });
    const total = (countRes.rows[0] as Record<string, unknown>)?.count as number || 0;

    // Fetch paginated users with role join
    const usersRes = await db.execute({
      sql: `SELECT u.id, u.email, u.name, u.phone, u.is_active, u.is_verified, u.avatar, u.created_at,
             r.name as role_name
             FROM users u LEFT JOIN roles r ON u.role_id = r.id
             ${whereClause}
             ORDER BY u.created_at DESC
             LIMIT ? OFFSET ?`,
      args: [...args, limit, offset],
    });

    // Map to camelCase with role as string name
    const users = usersRes.rows.map((u) => {
      const row = u as Record<string, unknown>;
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        phone: row.phone,
        isActive: !!row.is_active,
        isVerified: !!row.is_verified,
        avatar: row.avatar,
        createdAt: row.created_at,
        role: row.role_name || 'UTILISATEUR',
      };
    });

    return NextResponse.json({
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Get admin users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users
 * Update a user's role or active status.
 */
export async function PATCH(request: Request) {
  try {
    const authResult = await authenticateAdmin(request.headers);
    if (authResult instanceof NextResponse) return authResult;
    const adminUser = authResult.user;

    const body = await request.json();
    const { userId, role: roleName, isActive } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (roleName === undefined && isActive === undefined) {
      return NextResponse.json(
        { error: 'At least one of role or isActive must be provided' },
        { status: 400 }
      );
    }

    // Self-protection: cannot deactivate yourself
    if (isActive === false && userId === adminUser.id) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own account' },
        { status: 400 }
      );
    }

    // Role protection: only SUPER_ADMIN can assign ADMIN or SUPER_ADMIN roles
    if (roleName && (roleName === 'ADMIN' || roleName === 'SUPER_ADMIN')) {
      if (adminUser.role_name !== 'SUPER_ADMIN') {
        return NextResponse.json(
          { error: 'Only super admins can assign ADMIN or SUPER_ADMIN roles' },
          { status: 403 }
        );
      }
    }

    // Find the target user
    const targetUser = await turso.user.findUnique({ id: userId });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      );
    }

    // Build update data (snake_case for SQLite)
    const updateData: Record<string, unknown> = {};

    if (roleName) {
      const roleRecord = await turso.role.findUnique({ name: roleName });
      if (!roleRecord) {
        return NextResponse.json(
          { error: `Role "${roleName}" not found` },
          { status: 404 }
        );
      }
      updateData.role_id = roleRecord.id;
    }

    if (isActive !== undefined) {
      updateData.is_active = isActive ? 1 : 0;
    }

    // Update the user
    const updatedUserRaw = await turso.user.update({ id: userId }, updateData);

    if (!updatedUserRaw) {
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }

    // Map to camelCase with role as string name
    const updatedUser = {
      id: updatedUserRaw.id,
      email: updatedUserRaw.email,
      name: updatedUserRaw.name,
      phone: updatedUserRaw.phone,
      isActive: !!updatedUserRaw.is_active,
      isVerified: !!updatedUserRaw.is_verified,
      avatar: updatedUserRaw.avatar,
      createdAt: updatedUserRaw.created_at,
      updatedAt: updatedUserRaw.updated_at,
      role: updatedUserRaw.role_name || 'UTILISATEUR',
    };

    // Create audit log
    const details: Record<string, unknown> = { userId };
    if (roleName) details.role = roleName;
    if (isActive !== undefined) details.isActive = isActive;

    await turso.insert('audit_logs', mapUserToDb({
      userId: adminUser.id,
      action: isActive === false ? 'DEACTIVATE_USER' : isActive === true ? 'ACTIVATE_USER' : 'UPDATE_USER_ROLE',
      resource: 'USER',
      details: JSON.stringify(details),
    }));

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Patch admin users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users
 * Delete a user. SUPER_ADMIN only.
 */
export async function DELETE(request: Request) {
  try {
    const authResult = await authenticateAdmin(request.headers, true);
    if (authResult instanceof NextResponse) return authResult;
    const adminUser = authResult.user;

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Self-protection: cannot delete yourself
    if (userId === adminUser.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      );
    }

    // Check target user exists
    const targetUser = await turso.user.findUnique({ id: userId });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete the user
    await turso.user.delete({ id: userId });

    // Create audit log
    await turso.insert('audit_logs', mapUserToDb({
      userId: adminUser.id,
      action: 'DELETE_USER',
      resource: 'USER',
      details: JSON.stringify({ userId, email: targetUser.email, name: targetUser.name }),
    }));

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete admin users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
