import { NextResponse } from 'next/server';
import { turso, db } from '@/lib/db';
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

    const result = await turso.query(
      `SELECT mr.*, 
        m.id as mentor_id, m.expertise as mentor_expertise, m.availability as mentor_availability, m.experience as mentor_experience, m.rating as mentor_rating, m.accept_requests as mentor_accept_requests,
        mu.id as mentor_user_id, mu.name as mentor_user_name, mu.email as mentor_user_email, mu.avatar as mentor_user_avatar
       FROM mentor_requests mr
       JOIN mentors m ON mr.mentor_id = m.id
       JOIN users mu ON m.user_id = mu.id
       WHERE mr.mentee_id = ?
       ORDER BY mr.created_at DESC`,
      [user.id]
    );

    const requests = result.rows;

    const mapped = (requests || []).map((r: any) => ({
      id: r.id,
      menteeId: r.mentee_id,
      mentorId: r.mentor_id,
      message: r.message,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      mentor: {
        id: r.mentor_id,
        expertise: r.mentor_expertise,
        availability: r.mentor_availability,
        experience: r.mentor_experience,
        rating: r.mentor_rating,
        acceptRequests: !!r.mentor_accept_requests,
        user: {
          id: r.mentor_user_id,
          name: r.mentor_user_name,
          email: r.mentor_user_email,
          avatar: r.mentor_user_avatar,
        },
      },
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
    const mentor = await turso.findById('mentors', mentorId);
    if (!mentor || !(mentor as any).accept_requests) {
      return NextResponse.json(
        { error: 'Mentor not available for requests' },
        { status: 404 }
      );
    }

    // Check if request already exists
    const existing = await turso.query(
      `SELECT id FROM mentor_requests WHERE mentee_id = ? AND mentor_id = ? AND status = 'pending' LIMIT 1`,
      [user.id, mentorId]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'You already have a pending request to this mentor' },
        { status: 409 }
      );
    }

    const requestId = await turso.insert('mentor_requests', {
      mentee_id: user.id,
      mentor_id: mentorId,
      message: message || null,
    });

    const mentorRequest = await turso.findById('mentor_requests', requestId);

    // Notify the mentor
    await turso.insert('notifications', {
      user_id: (mentor as any).user_id,
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
