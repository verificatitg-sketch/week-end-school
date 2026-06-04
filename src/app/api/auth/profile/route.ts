import { NextResponse } from 'next/server';
import { turso, mapUserToApi } from '@/lib/db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

export async function PATCH(request: Request) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token invalide ou expiré' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, email, phone, location } = body;

    // Build update data (snake_case for SQLite)
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (location !== undefined) updateData.location = location;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Aucune donnée à mettre à jour' },
        { status: 400 }
      );
    }

    const updatedUser = await turso.user.update({ id: payload.userId as string }, updateData);

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour' },
        { status: 500 }
      );
    }

    const { password: _, ...mappedUser } = mapUserToApi(updatedUser)!;

    // Ensure role is a string for the frontend
    const responseUser = {
      ...mappedUser,
      role: mappedUser.role?.name || updatedUser.role_name || 'UTILISATEUR',
    };

    return NextResponse.json({ user: responseUser });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
