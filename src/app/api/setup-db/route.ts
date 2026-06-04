import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/setup-db
 * Check the current status of the Supabase database setup.
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
      const { error } = await supabaseAdmin.from(table).select('id').limit(1);
      if (error) {
        missing.push(table);
      } else {
        existing.push(table);
      }
    }

    // Check if admin user exists
    let adminExists = false;
    if (existing.includes('users') && existing.includes('roles')) {
      const { data: adminRole } = await supabaseAdmin.from('roles').select('id').eq('name', 'SUPER_ADMIN').single();
      if (adminRole) {
        const { data: adminUsers } = await supabaseAdmin.from('users').select('id').eq('role_id', adminRole.id).limit(1);
        if (adminUsers && adminUsers.length > 0) {
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
      sqlEditorUrl: 'https://supabase.com/dashboard/project/omiexeswwdqffivxlhel/sql',
      instructions: missing.length > 0 ? [
        '1. Go to the Supabase Dashboard SQL Editor',
        '2. Copy the contents of supabase-schema.sql from the project root',
        '3. Paste and run the SQL',
        '4. Then call POST /api/seed to create the admin user and sample data',
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
