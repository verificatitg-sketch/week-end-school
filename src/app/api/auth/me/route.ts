import { NextResponse } from 'next/server';
import { turso, mapUserToApi } from '@/lib/db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization token required' },
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

    const id = payload.userId as string;

    // Fetch user with role (turso.user.findUnique already JOINs roles)
    const dbUser = await turso.user.findUnique({ id });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch badges separately using raw query
    const badgesResult = await turso.query(
      `SELECT ub.*, b.id as badge_id_col, b.name, b.description, b.icon, b.category, b.created_at as badge_created_at
       FROM user_badges ub
       LEFT JOIN badges b ON ub.badge_id = b.id
       WHERE ub.user_id = ?`,
      [id]
    );

    // Fetch mentor profile separately using raw query
    const mentorResult = await turso.query(
      'SELECT * FROM mentors WHERE user_id = ?',
      [id]
    );

    // Map user to API format (camelCase)
    const mappedUser = mapUserToApi(dbUser);
    if (!mappedUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Map badges with camelCase conversion
    const badges = badgesResult.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      userId: row.user_id,
      badgeId: row.badge_id,
      earnedAt: row.earned_at ?? row.created_at,
      badge: row.badge_id_col ? {
        id: row.badge_id_col,
        name: row.name,
        description: row.description,
        icon: row.icon,
        category: row.category,
        createdAt: row.badge_created_at,
      } : null,
    }));

    // Map mentor profile with camelCase conversion
    const mentorRow = mentorResult.rows[0] as Record<string, unknown> | undefined;
    const mentorProfile = mentorRow
      ? {
          id: mentorRow.id,
          userId: mentorRow.user_id,
          bio: mentorRow.bio,
          expertise: mentorRow.expertise,
          isAvailable: !!mentorRow.is_available,
          createdAt: mentorRow.created_at,
          updatedAt: mentorRow.updated_at,
        }
      : null;

    const { password: _, ...userWithoutPassword } = {
      ...mappedUser,
      badges,
      mentorProfile,
    };

    // Ensure role is a string for the frontend (auth-store expects role?: string)
    const responseUser = {
      ...userWithoutPassword,
      role: mappedUser.role?.name || dbUser.role_name || 'UTILISATEUR',
    };

    return NextResponse.json({ user: responseUser });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
