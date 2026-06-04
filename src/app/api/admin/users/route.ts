import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * Helper: Authenticate and authorize the request.
 * Returns the authenticated user (with role) or a NextResponse error.
 */
async function authenticateAdmin(
  headers: Headers,
  requireSuperAdmin = false
): Promise<{ user: Awaited<ReturnType<typeof db.user.findUnique>> } | NextResponse> {
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

  const user = await db.user.findUnique({
    where: { id: payload.userId as string },
    include: { role: true },
  });

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

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    if (role) {
      where.role = { name: role };
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          isActive: true,
          isVerified: true,
          avatar: true,
          createdAt: true,
          role: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

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
      if (adminUser.role?.name !== 'SUPER_ADMIN') {
        return NextResponse.json(
          { error: 'Only super admins can assign ADMIN or SUPER_ADMIN roles' },
          { status: 403 }
        );
      }
    }

    // Find the target user
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (roleName) {
      const roleRecord = await db.role.findUnique({ where: { name: roleName } });
      if (!roleRecord) {
        return NextResponse.json(
          { error: `Role "${roleName}" not found` },
          { status: 404 }
        );
      }
      updateData.roleId = roleRecord.id;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    // Update the user
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isActive: true,
        isVerified: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: { id: true, name: true },
        },
      },
    });

    // Create audit log
    const details: Record<string, unknown> = { userId };
    if (roleName) details.role = roleName;
    if (isActive !== undefined) details.isActive = isActive;

    await db.auditLog.create({
      data: {
        userId: adminUser.id,
        action: isActive === false ? 'DEACTIVATE_USER' : isActive === true ? 'ACTIVATE_USER' : 'UPDATE_USER_ROLE',
        resource: 'USER',
        details: JSON.stringify(details),
      },
    });

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
    const targetUser = await db.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete the user
    await db.user.delete({
      where: { id: userId },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: adminUser.id,
        action: 'DELETE_USER',
        resource: 'USER',
        details: JSON.stringify({ userId, email: targetUser.email, name: targetUser.name }),
      },
    });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete admin users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
