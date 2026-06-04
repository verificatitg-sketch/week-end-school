import { NextResponse } from 'next/server';
import { sb, mapUserToApi, mapUserToDb } from '@/lib/supabase';
import { hashPassword, createToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, password, phone, gender, disability, location } = body;

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: 'Email, name, and password are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await sb.user.findUnique({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Find default role
    let role = await sb.role.findUnique({ name: 'UTILISATEUR' });
    if (!role) {
      role = await sb.role.create({
        name: 'UTILISATEUR',
        description: 'Default user role',
      });
    }

    const hashedPassword = await hashPassword(password);

    const user = await sb.user.create(
      mapUserToDb({
        email,
        name,
        password: hashedPassword,
        phone: phone || null,
        gender: gender || null,
        disability: disability || null,
        location: location || null,
        roleId: role.id,
      })
    );

    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role?.name,
    });

    const { password: _, ...mappedUser } = mapUserToApi(user)!;

    return NextResponse.json(
      {
        message: 'Registration successful',
        token,
        user: mappedUser,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
