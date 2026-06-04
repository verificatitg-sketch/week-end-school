import { NextResponse } from 'next/server';
import { turso, db } from '@/lib/db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

async function getAuthUser(request: Request) {
  const token = getTokenFromHeaders(request.headers);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const user = await turso.user.findUnique({ id: payload.userId as string });
  return user;
}

export async function GET() {
  try {
    const result = await turso.query(
      `SELECT m.*, u.id as user_id, u.name as user_name, u.email as user_email, u.avatar as user_avatar, u.bio as user_bio, u.location as user_location
       FROM mentors m 
       JOIN users u ON m.user_id = u.id 
       WHERE m.accept_requests = 1 
       ORDER BY m.rating DESC`
    );

    const mentors = result.rows;

    const mapped = (mentors || []).map((m: any) => ({
      id: m.id,
      userId: m.user_id,
      expertise: m.expertise,
      availability: m.availability,
      experience: m.experience,
      rating: m.rating,
      acceptRequests: !!m.accept_requests,
      user: {
        id: m.user_id,
        name: m.user_name,
        email: m.user_email,
        avatar: m.user_avatar,
        bio: m.user_bio,
        location: m.user_location,
      },
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
    const existing = await turso.findMany('mentors', {
      where: { user_id: user.id },
      limit: 1,
    });

    if (existing && existing.length > 0) {
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
    const mentorRole = await turso.role.findUnique({ name: 'MENTOR' });
    if (!mentorRole) {
      // Create the role if it doesn't exist
      const newRole = await turso.role.create({ name: 'MENTOR', description: 'Mentor role' });
      if (newRole) {
        await turso.user.update({ id: user.id }, { role_id: newRole.id });
      }
    } else {
      await turso.user.update({ id: user.id }, { role_id: mentorRole.id });
    }

    const mentorId = await turso.insert('mentors', {
      user_id: user.id,
      expertise,
      availability,
      experience: experience || null,
    });

    // Fetch the mentor with user data
    const mentorResult = await turso.query(
      `SELECT m.*, u.id as user_id, u.name as user_name, u.email as user_email, u.avatar as user_avatar, u.bio as user_bio
       FROM mentors m 
       JOIN users u ON m.user_id = u.id 
       WHERE m.id = ?`,
      [mentorId]
    );

    const mentor = mentorResult.rows[0] || null;

    return NextResponse.json({ mentor }, { status: 201 });
  } catch (error) {
    console.error('Create mentor error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
