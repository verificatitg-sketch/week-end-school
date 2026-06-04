import { NextResponse } from 'next/server';
import { turso, mapUserToApi, mapUserToDb } from '@/lib/db';
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
    const existingUser = await turso.user.findUnique({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Find default role
    let role = await turso.role.findUnique({ name: 'UTILISATEUR' });
    if (!role) {
      role = await turso.role.create({
        name: 'UTILISATEUR',
        description: 'Default user role',
      });
    }

    const hashedPassword = await hashPassword(password);

    const user = await turso.user.create(
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
      userId: user!.id,
      email: user!.email,
      role: user!.role_name,
    });

    const { password: _, ...mappedUser } = mapUserToApi(user)!;

    // Ensure role is a string for the frontend (auth-store expects role?: string)
    const responseUser = {
      ...mappedUser,
      role: mappedUser.role?.name || user!.role_name || 'UTILISATEUR',
    };

    return NextResponse.json(
      {
        message: 'Registration successful',
        token,
        user: responseUser,
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
