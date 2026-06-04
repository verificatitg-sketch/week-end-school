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

    const { data: requests, error } = await supabaseAdmin
      .from('mentor_requests')
      .select('*, mentor:mentors(*, user:users(id, name, email, avatar))')
      .eq('mentee_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const mapped = (requests || []).map((r: any) => ({
      id: r.id,
      menteeId: r.mentee_id,
      mentorId: r.mentor_id,
      message: r.message,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      mentor: r.mentor,
    }));

    return NextResponse.json({ requests: mapped });
  } catch (error) {
    console.error('Get mentor requests error:', error);
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
    const { mentorId, message } = body;

    if (!mentorId) {
      return NextResponse.json(
        { error: 'Mentor ID is required' },
        { status: 400 }
      );
    }

    // Check mentor exists and accepts requests
    const { data: mentor } = await supabaseAdmin
      .from('mentors')
      .select('*')
      .eq('id', mentorId)
      .single();

    if (!mentor || !mentor.accept_requests) {
      return NextResponse.json(
        { error: 'Mentor not available for requests' },
        { status: 404 }
      );
    }

    // Check if request already exists
    const { data: existing } = await supabaseAdmin
      .from('mentor_requests')
      .select('id')
      .eq('mentee_id', user.id)
      .eq('mentor_id', mentorId)
      .eq('status', 'pending')
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'You already have a pending request to this mentor' },
        { status: 409 }
      );
    }

    const { data: mentorRequest, error } = await supabaseAdmin
      .from('mentor_requests')
      .insert({
        mentee_id: user.id,
        mentor_id: mentorId,
        message: message || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Notify the mentor
    await supabaseAdmin.from('notifications').insert({
      user_id: mentor.user_id,
      title: 'Nouvelle demande de mentorat',
      message: `${user.name} vous a envoyé une demande de mentorat`,
      type: 'mentorship',
    });

    return NextResponse.json({ request: mentorRequest }, { status: 201 });
  } catch (error) {
    console.error('Create mentor request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
