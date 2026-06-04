import { NextResponse } from 'next/server';
import { turso } from '@/lib/db';
import { verifyToken, getTokenFromHeaders, hashPassword } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    // Authenticate - require ADMIN or SUPER_ADMIN
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

    const adminUser = await turso.user.findUnique({ id: payload.userId as string });
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    const isAdmin =
      adminUser.role_name === 'SUPER_ADMIN' || adminUser.role_name === 'ADMIN';

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Accès administrateur requis' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, newPassword } = body;

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'ID utilisateur et nouveau mot de passe requis' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      );
    }

    // Check target user exists
    const targetUser = await turso.user.findUnique({ id: userId });
    if (!targetUser) {
      return NextResponse.json(
        { error: 'Utilisateur cible non trouvé' },
        { status: 404 }
      );
    }

    // Only SUPER_ADMIN can reset passwords for ADMIN or SUPER_ADMIN accounts
    if (
      (targetUser.role_name === 'SUPER_ADMIN' || targetUser.role_name === 'ADMIN') &&
      adminUser.role_name !== 'SUPER_ADMIN'
    ) {
      return NextResponse.json(
        { error: 'Seul un Super Admin peut réinitialiser le mot de passe d\'un compte Admin ou Super Admin' },
        { status: 403 }
      );
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update the user's password
    await turso.user.update({ id: userId }, { password: hashedPassword });

    // Create audit log
    await turso.insert('audit_logs', {
      user_id: adminUser.id,
      action: 'RESET_PASSWORD',
      resource: 'USER',
      details: JSON.stringify({ targetUserId: userId, targetEmail: targetUser.email }),
    });

    return NextResponse.json({
      message: 'Mot de passe réinitialisé avec succès',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la réinitialisation du mot de passe' },
      { status: 500 }
    );
  }
}
