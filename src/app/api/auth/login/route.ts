import { NextResponse } from 'next/server';
import { sb, mapUserToApi } from '@/lib/supabase';
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

    const user = await sb.user.findUnique({ email });

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
      role: user.role?.name,
    });

    const { password: _, ...mappedUser } = mapUserToApi(user)!;

    return NextResponse.json({
      message: 'Login successful',
      token,
      user: mappedUser,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
