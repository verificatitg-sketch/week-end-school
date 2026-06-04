import { NextResponse } from 'next/server';
import { turso, mapUserToApi } from '@/lib/db';
import { verifyPassword, createToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await turso.user.findUnique({ email });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Account is deactivated' },
        { status: 403 }
      );
    }

    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role_name,
    });

    const { password: _, ...mappedUser } = mapUserToApi(user)!;

    // Ensure role is a string for the frontend (auth-store expects role?: string)
    const responseUser = {
      ...mappedUser,
      role: mappedUser.role?.name || user.role_name || 'UTILISATEUR',
    };

    return NextResponse.json({
      message: 'Login successful',
      token,
      user: responseUser,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
