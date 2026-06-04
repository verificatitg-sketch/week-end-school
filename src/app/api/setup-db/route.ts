import { NextResponse } from 'next/server';
import { turso, db } from '@/lib/db';

/**
 * GET /api/setup-db
 * Check the current status of the Turso database setup.
 */
export async function GET() {
  try {
    const criticalTables = ['roles', 'users'];
    const allTables = [
      'roles', 'users', 'courses', 'course_modules', 'lessons',
      'quizzes', 'quiz_questions', 'quiz_results', 'enrollments',
      'lesson_progress', 'certificates', 'badges', 'user_badges',
      'opportunities', 'applications', 'mentors', 'mentor_requests',
      'community_posts', 'comments', 'likes', 'groups', 'group_members',
      'messages', 'reports', 'report_attachments', 'sos_alerts',
      'sos_interventions', 'sos_gps_updates', 'sos_call_logs',
      'notifications', 'chatbot_logs', 'audit_logs', 'settings',
      'regions', 'districts', 'communities',
    ];

    const existing: string[] = [];
    const missing: string[] = [];

    for (const table of allTables) {
      try {
        await turso.query(`SELECT id FROM ${table} LIMIT 1`);
        existing.push(table);
      } catch {
        missing.push(table);
      }
    }

    // Check if admin user exists
    let adminExists = false;
    if (existing.includes('users') && existing.includes('roles')) {
      const adminRole = await turso.role.findUnique({ name: 'SUPER_ADMIN' });
      if (adminRole) {
        const adminUsers = await turso.query(
          'SELECT id FROM users WHERE role_id = ? LIMIT 1',
          [adminRole.id]
        );
        if (adminUsers.rows.length > 0) {
          adminExists = true;
        }
      }
    }

    const isReady = missing.length === 0 && adminExists;

    return NextResponse.json({
      status: isReady ? 'ready' : (existing.length > 0 ? 'partial' : 'needs_setup'),
      tables: { existing: existing.length, missing: missing.length, total: allTables.length },
      existingTables: existing,
      missingTables: missing,
      adminExists,
      criticalReady: criticalTables.every(t => existing.includes(t)),
      instructions: missing.length > 0 ? [
        '1. Run the Turso schema SQL to create the missing tables',
        '2. Then call POST /api/seed to create the admin user and sample data',
      ] : (!adminExists ? [
        'Tables are created! Now seed the database:',
        'Call POST /api/seed to create the admin user and sample data',
      ] : [
        'Database is fully set up and ready!',
        'Admin: blunaantoine@gmail.com / admin123',
      ]),
    });
  } catch (error) {
    console.error('Check setup status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
