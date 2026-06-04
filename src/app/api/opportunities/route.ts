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
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    let query = supabaseAdmin
      .from('opportunities')
      .select('*, applications(count)')
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    const { data: opportunities, error } = await query;
    if (error) throw error;

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
      published: o.published,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      _count: {
        applications: o.applications?.[0]?.count || 0,
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
      user.role?.name === 'SUPER_ADMIN' || user.role?.name === 'ADMIN';
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

    const { data: opportunity, error } = await supabaseAdmin
      .from('opportunities')
      .insert({
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
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        url: url || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ opportunity }, { status: 201 });
  } catch (error) {
    console.error('Create opportunity error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
