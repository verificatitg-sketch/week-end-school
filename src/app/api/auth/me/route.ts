import { NextResponse } from 'next/server';
import { supabaseAdmin, mapUserToApi } from '@/lib/supabase';
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

    // Fetch user with role
    const { data: dbUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('*, role:roles(*)')
      .eq('id', id)
      .single();

    if (userError || !dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch badges separately (Supabase doesn't support deep nested includes like Prisma)
    const { data: dbBadges } = await supabaseAdmin
      .from('user_badges')
      .select('*, badge:badges(*)')
      .eq('user_id', id);

    // Fetch mentor profile separately
    const { data: dbMentorProfile } = await supabaseAdmin
      .from('mentors')
      .select('*')
      .eq('user_id', id)
      .single();

    // Map user to API format (camelCase)
    const mappedUser = mapUserToApi(dbUser);
    if (!mappedUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Add badges with camelCase mapping
    const badges = (dbBadges || []).map((ub: Record<string, unknown>) => ({
      id: ub.id,
      userId: ub.user_id,
      badgeId: ub.badge_id,
      earnedAt: ub.earned_at ?? ub.created_at,
      badge: ub.badge,
    }));

    // Add mentor profile with camelCase mapping
    const mentorProfile = dbMentorProfile
      ? (() => {
          const mp = dbMentorProfile as Record<string, unknown>;
          return {
            id: mp.id,
            userId: mp.user_id,
            bio: mp.bio,
            expertise: mp.expertise,
            isAvailable: mp.is_available,
            createdAt: mp.created_at,
            updatedAt: mp.updated_at,
          };
        })()
      : null;

    const { password: _, ...userWithoutPassword } = {
      ...mappedUser,
      badges,
      mentorProfile,
    };

    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
