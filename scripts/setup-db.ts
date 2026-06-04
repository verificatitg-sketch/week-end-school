import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

const dbPassword = process.argv[2];
if (!dbPassword) {
  console.error('Usage: bun run scripts/setup-db.ts <database_password>');
  console.error('Get your password from: https://supabase.com/dashboard/project/omiexeswwdqffivxlhel/settings/database');
  process.exit(1);
}

const PROJECT_REF = 'omiexeswwdqffivxlhel';
const POOLER_HOST = 'aws-0-eu-west-3.pooler.supabase.com';
const DB_USER = `postgres.${PROJECT_REF}`;

console.log('=== WEDS Supabase Database Setup ===');
console.log(`Project: ${PROJECT_REF}`);
console.log(`Connecting via pooler: ${POOLER_HOST}:6543`);
console.log('');

async function main() {
  const sql = postgres({
    host: POOLER_HOST,
    port: 6543,
    username: DB_USER,
    password: dbPassword,
    database: 'postgres',
    connect_timeout: 15,
    ssl: 'require',
  });

  try {
    // Test connection
    const result = await sql`SELECT current_database(), current_user`;
    console.log(`✅ Connected! DB: ${result[0].current_database}, User: ${result[0].current_user}`);

    // Read and execute schema
    const schemaPath = join(import.meta.dir, '..', 'supabase-schema.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf-8');

    console.log('\n📦 Creating tables...');
    await sql.unsafe(schemaSQL);
    console.log('✅ All tables created successfully!');

    // Verify tables
    const tables = await sql`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `;
    console.log(`\n📊 Created ${tables.length} tables:`);
    for (const t of tables) {
      console.log(`   ✅ ${t.tablename}`);
    }

    console.log('\n🎉 Database setup complete!');
    console.log('\nNext step: Seed the database by calling:');
    console.log('  curl -X POST https://your-app.vercel.app/api/seed');
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
