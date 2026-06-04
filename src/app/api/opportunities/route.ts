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
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    let sql = `SELECT o.*, 
      (SELECT COUNT(*) FROM applications a WHERE a.opportunity_id = o.id) as application_count
      FROM opportunities o WHERE o.published = 1`;
    const args: unknown[] = [];

    if (type) {
      sql += ' AND o.type = ?';
      args.push(type);
    }

    sql += ' ORDER BY o.created_at DESC';

    const result = await turso.query(sql, args);
    const opportunities = result.rows;

    const mapped = (opportunities || []).map((o: any) => ({
      id: o.id,
      title: o.title,
      description: o.description,
      type: o.type,
      organization: o.organization,
      location: o.location,
      latitude: o.latitude,
      longitude: o.longitude,
      deadline: o.deadline,
      salary: o.salary,
      requirements: o.requirements,
      contactEmail: o.contact_email,
      contactPhone: o.contact_phone,
      url: o.url,
      published: !!o.published,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      _count: {
        applications: Number(o.application_count) || 0,
      },
    }));

    return NextResponse.json({ opportunities: mapped });
  } catch (error) {
    console.error('Get opportunities error:', error);
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

    const isAdmin =
      user.role_name === 'SUPER_ADMIN' || user.role_name === 'ADMIN';
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title, description, type, organization, location,
      latitude, longitude, deadline, salary, requirements,
      contactEmail, contactPhone, url,
    } = body;

    if (!title || !description || !type) {
      return NextResponse.json(
        { error: 'Title, description, and type are required' },
        { status: 400 }
      );
    }

    const insertData = mapUserToDb({
      title,
      description,
      type,
      organization: organization || null,
      location: location || null,
      latitude: latitude || null,
      longitude: longitude || null,
      deadline: deadline || null,
      salary: salary || null,
      requirements: requirements || null,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      url: url || null,
      published: true,
    });

    const id = await turso.insert('opportunities', insertData);
    const opportunity = await turso.findById('opportunities', id);

    return NextResponse.json({ opportunity }, { status: 201 });
  } catch (error) {
    console.error('Create opportunity error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
