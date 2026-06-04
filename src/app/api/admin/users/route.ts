import { NextResponse } from 'next/server';
import { supabaseAdmin, sb, mapUserToDb, DbUser } from '@/lib/supabase';
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

  const user = await sb.user.findUnique({ id: payload.userId as string });

  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  const isSuperAdmin = user.role?.name === 'SUPER_ADMIN';
  const isAdmin = isSuperAdmin || user.role?.name === 'ADMIN';

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
      const roleRecord = await sb.role.findUnique({ name: role });
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

    // Build the Supabase query with count
    const selectStr = 'id, email, name, phone, is_active, is_verified, avatar, created_at, role:roles(id, name)';
    let query = supabaseAdmin
      .from('users')
      .select(selectStr, { count: 'exact' });

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    // Apply role filter
    if (roleId) {
      query = query.eq('role_id', roleId);
    }

    // Order and paginate
    query = query.order('created_at', { ascending: false });
    query = query.range(offset, offset + limit - 1);

    const { data: usersRaw, count: total, error } = await query;

    if (error) {
      console.error('Get admin users query error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    // Map snake_case to camelCase with role as string name
    const users = (usersRaw || []).map((u: Record<string, unknown>) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      isActive: u.is_active,
      isVerified: u.is_verified,
      avatar: u.avatar,
      createdAt: u.created_at,
      role: (u.role as { name: string } | null)?.name || 'UTILISATEUR',
    }));

    return NextResponse.json({
      users,
      total: total || 0,
      page,
      limit,
      totalPages: Math.ceil((total || 0) / limit),
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
      if (adminUser.role?.name !== 'SUPER_ADMIN') {
        return NextResponse.json(
          { error: 'Only super admins can assign ADMIN or SUPER_ADMIN roles' },
          { status: 403 }
        );
      }
    }

    // Find the target user
    const targetUser = await sb.user.findUnique({ id: userId });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      );
    }

    // Build update data (snake_case for Supabase)
    const updateData: Record<string, unknown> = {};

    if (roleName) {
      const roleRecord = await sb.role.findUnique({ name: roleName });
      if (!roleRecord) {
        return NextResponse.json(
          { error: `Role "${roleName}" not found` },
          { status: 404 }
        );
      }
      updateData.role_id = roleRecord.id;
    }

    if (isActive !== undefined) {
      updateData.is_active = isActive;
    }

    // Update the user
    const updatedUserRaw = await sb.user.update({ id: userId }, updateData);

    // Map to camelCase with role as string name
    const updatedUser = {
      id: updatedUserRaw.id,
      email: updatedUserRaw.email,
      name: updatedUserRaw.name,
      phone: updatedUserRaw.phone,
      isActive: updatedUserRaw.is_active,
      isVerified: updatedUserRaw.is_verified,
      avatar: updatedUserRaw.avatar,
      createdAt: updatedUserRaw.created_at,
      updatedAt: updatedUserRaw.updated_at,
      role: updatedUserRaw.role?.name || 'UTILISATEUR',
    };

    // Create audit log
    const details: Record<string, unknown> = { userId };
    if (roleName) details.role = roleName;
    if (isActive !== undefined) details.isActive = isActive;

    await supabaseAdmin.from('audit_logs').insert(mapUserToDb({
      userId: adminUser.id,
      action: isActive === false ? 'DEACTIVATE_USER' : isActive === true ? 'ACTIVATE_USER' : 'UPDATE_USER_ROLE',
      resource: 'USER',
      details: JSON.stringify(details),
    })).select().single();

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
    const targetUser = await sb.user.findUnique({ id: userId });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete the user
    await sb.user.delete({ id: userId });

    // Create audit log
    await supabaseAdmin.from('audit_logs').insert(mapUserToDb({
      userId: adminUser.id,
      action: 'DELETE_USER',
      resource: 'USER',
      details: JSON.stringify({ userId, email: targetUser.email, name: targetUser.name }),
    })).select().single();

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete admin users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
