import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * POST /api/setup-db
 * Sets up the Supabase database by creating all required tables.
 * This is a one-time setup operation.
 * 
 * Body: { password: string } (optional - database password for direct SQL execution)
 */
export async function POST(request: Request) {
  try {
    // Check if tables already exist
    const { data: existingUsers, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id')
      .limit(1);

    if (!checkError && existingUsers) {
      return NextResponse.json({
        message: 'Database tables already exist. Setup is not needed.',
        status: 'already_setup',
      });
    }

    // Try to read the SQL schema file
    let sql: string;
    try {
      const schemaPath = join(process.cwd(), 'supabase-schema.sql');
      sql = readFileSync(schemaPath, 'utf-8');
    } catch {
      return NextResponse.json({
        error: 'SQL schema file not found',
        status: 'schema_not_found',
        instructions: 'Please copy the contents of supabase-schema.sql and run it in the Supabase Dashboard SQL Editor.',
        sqlEditorUrl: 'https://supabase.com/dashboard/project/omiexeswwdqffivxlhel/sql',
      }, { status: 500 });
    }

    // Try executing SQL via the postgres package if password is provided
    const body = await request.json().catch(() => ({}));
    const dbPassword = body.password;

    if (dbPassword) {
      try {
        const postgres = (await import('postgres')).default;
        
        const poolerHost = 'aws-0-eu-west-3.pooler.supabase.com';
        const sql_conn = postgres({
          host: poolerHost,
          port: 6543,
          username: 'postgres.omiexeswwdqffivxlhel',
          password: dbPassword,
          database: 'postgres',
          connect_timeout: 15,
          ssl: 'require',
        });

        // Execute the schema SQL
        await sql_conn.unsafe(sql);
        await sql_conn.end();

        return NextResponse.json({
          message: 'Database setup completed successfully! All tables created.',
          status: 'success',
        });
      } catch (sqlError: unknown) {
        const errMsg = sqlError instanceof Error ? sqlError.message : String(sqlError);
        console.error('SQL execution error:', errMsg);
        return NextResponse.json({
          error: 'Failed to execute SQL via direct connection',
          details: errMsg,
          status: 'sql_execution_failed',
          instructions: 'Please copy the contents of supabase-schema.sql and run it in the Supabase Dashboard SQL Editor.',
          sqlEditorUrl: 'https://supabase.com/dashboard/project/omiexeswwdqffivxlhel/sql',
        }, { status: 500 });
      }
    }

    // No password provided - return instructions
    return NextResponse.json({
      message: 'Database tables need to be created. Please run the SQL schema in the Supabase Dashboard SQL Editor.',
      status: 'needs_manual_setup',
      instructions: [
        '1. Go to the Supabase Dashboard SQL Editor',
        '2. Copy the contents of supabase-schema.sql',
        '3. Paste and run the SQL',
        '4. Come back and the app will work automatically',
      ],
      sqlEditorUrl: 'https://supabase.com/dashboard/project/omiexeswwdqffivxlhel/sql',
      sqlContent: sql,
    });
  } catch (error) {
    console.error('Setup database error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/setup-db
 * Check the current status of the Supabase database setup.
 */
export async function GET() {
  try {
    const tables = [
      'users', 'roles', 'courses', 'course_modules', 'lessons',
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

    for (const table of tables) {
      const { error } = await supabaseAdmin.from(table).select('id').limit(1);
      if (error) {
        missing.push(table);
      } else {
        existing.push(table);
      }
    }

    // Check if admin user exists
    let adminExists = false;
    if (existing.includes('users')) {
      const { data: adminRole } = await supabaseAdmin.from('roles').select('id').eq('name', 'SUPER_ADMIN').single();
      if (adminRole) {
        const { data: adminUser } = await supabaseAdmin.from('users').select('id').eq('role_id', adminRole.id).limit(1);
        if (adminUser && adminUser.length > 0) {
          adminExists = true;
        }
      }
    }

    return NextResponse.json({
      status: missing.length === 0 ? 'ready' : 'needs_setup',
      tables: { existing: existing.length, missing: missing.length, total: tables.length },
      missingTables: missing,
      adminExists,
      sqlEditorUrl: 'https://supabase.com/dashboard/project/omiexeswwdqffivxlhel/sql',
    });
  } catch (error) {
    console.error('Check setup status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
