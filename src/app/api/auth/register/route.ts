import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
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
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Find default role
    let role = await db.role.findUnique({ where: { name: 'UTILISATEUR' } });
    if (!role) {
      role = await db.role.create({
        data: { name: 'UTILISATEUR', description: 'Default user role' },
      });
    }

    const hashedPassword = await hashPassword(password);

    const user = await db.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        phone: phone || null,
        gender: gender || null,
        disability: disability || null,
        location: location || null,
        roleId: role.id,
      },
      include: { role: true },
    });

    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role?.name,
    });

    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(
      {
        message: 'Registration successful',
        token,
        user: userWithoutPassword,
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
