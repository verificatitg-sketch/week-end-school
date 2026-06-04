import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: payload.userId as string },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
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

    // Get counts
    const [
      users,
      courses,
      enrollments,
      opportunities,
      sosAlerts,
      reports,
      certificates,
      mentors,
      communityPosts,
    ] = await Promise.all([
      db.user.count(),
      db.course.count(),
      db.enrollment.count(),
      db.opportunity.count(),
      db.sosAlert.count(),
      db.report.count(),
      db.certificate.count(),
      db.mentor.count(),
      db.communityPost.count(),
    ]);

    // Get recent activity
    const recentUsers = await db.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    const recentEnrollments = await db.enrollment.findMany({
      take: 5,
      orderBy: { enrolledAt: 'desc' },
      include: {
        user: { select: { name: true } },
        course: { select: { title: true } },
      },
    });

    const recentSosAlerts = await db.sosAlert.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true } },
      },
    });

    // Get user role distribution
    const allRoles = await db.user.findMany({
      select: { role: { select: { name: true } } },
    });

    const roleDistribution: Record<string, number> = {};
    for (const u of allRoles) {
      const roleName = u.role?.name || 'NO_ROLE';
      roleDistribution[roleName] = (roleDistribution[roleName] || 0) + 1;
    }

    // Get SOS alert status distribution
    const allSosAlerts = await db.sosAlert.findMany({
      select: { status: true },
    });

    const sosStatusDistribution: Record<string, number> = {};
    for (const a of allSosAlerts) {
      sosStatusDistribution[a.status] =
        (sosStatusDistribution[a.status] || 0) + 1;
    }

    return NextResponse.json({
      stats: {
        users,
        courses,
        enrollments,
        opportunities,
        sosAlerts,
        reports,
        certificates,
        mentors,
        communityPosts,
      },
      recentActivity: {
        users: recentUsers,
        enrollments: recentEnrollments,
        sosAlerts: recentSosAlerts,
      },
      distributions: {
        roles: roleDistribution,
        sosStatus: sosStatusDistribution,
      },
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
