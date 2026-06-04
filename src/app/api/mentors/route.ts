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

export async function GET() {
  try {
    const { data: mentors, error } = await supabaseAdmin
      .from('mentors')
      .select('*, user:users(id, name, email, avatar, bio, location)')
      .eq('accept_requests', true)
      .order('rating', { ascending: false });

    if (error) throw error;

    const mapped = (mentors || []).map((m: any) => ({
      id: m.id,
      userId: m.user_id,
      expertise: m.expertise,
      availability: m.availability,
      experience: m.experience,
      rating: m.rating,
      acceptRequests: m.accept_requests,
      user: m.user,
    }));

    return NextResponse.json({ mentors: mapped });
  } catch (error) {
    console.error('Get mentors error:', error);
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

    // Check if already a mentor
    const { data: existing } = await supabaseAdmin
      .from('mentors')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'You are already registered as a mentor' },
        { status: 409 }
      );
    }

    const body = await request.json();
    const { expertise, availability, experience } = body;

    if (!expertise || !availability) {
      return NextResponse.json(
        { error: 'Expertise and availability are required' },
        { status: 400 }
      );
    }

    // Update role to MENTOR
    const mentorRole = await sb.role.findUnique({ name: 'MENTOR' });
    if (!mentorRole) {
      // Create the role if it doesn't exist
      const newRole = await sb.role.create({ name: 'MENTOR', description: 'Mentor role' });
      if (newRole) {
        await sb.user.update({ id: user.id }, { role_id: newRole.id });
      }
    } else {
      await sb.user.update({ id: user.id }, { role_id: mentorRole.id });
    }

    const { data: mentor, error } = await supabaseAdmin
      .from('mentors')
      .insert({
        user_id: user.id,
        expertise,
        availability,
        experience: experience || null,
      })
      .select('*, user:users(id, name, email, avatar, bio)')
      .single();

    if (error) throw error;

    return NextResponse.json({ mentor }, { status: 201 });
  } catch (error) {
    console.error('Create mentor error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
