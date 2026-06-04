# Task 5 - Supabase Admin API Routes Migration

## Task
Migrate 2 admin API routes from Prisma/SQLite to Supabase.

## Files Modified
1. `/src/app/api/admin/users/route.ts` - Replaced all Prisma db calls with Supabase sb helpers + supabaseAdmin direct queries
2. `/src/app/api/admin/stats/route.ts` - Replaced all Prisma db calls with Supabase direct queries + recursive camelCase mapper

## Key Decisions
- **authenticateAdmin helper**: Changed return type from Prisma-derived `Awaited<ReturnType<typeof db.user.findUnique>>` to `DbUser` from supabase.ts
- **Users GET**: Single Supabase query with `count: 'exact'` instead of separate `findMany` + `count`. Uses `.or('name.ilike.%...,email.ilike.%...,phone.ilike.%...')` for search and `.eq('role_id', roleId)` for role filter after looking up role_id via `sb.role.findUnique`
- **Users PATCH**: Update data uses snake_case keys (`role_id`, `is_active`) since `sb.user.update` passes data directly to Supabase
- **Audit logs**: All `db.auditLog.create()` replaced with `supabaseAdmin.from('audit_logs').insert(mapUserToDb({...})).select().single()`. `mapUserToDb` handles `userId` → `user_id` conversion; other fields (action, resource, details) pass through unchanged
- **Stats counts**: Used `supabaseAdmin.from('table').select('*', { count: 'exact', head: true })` for each table in parallel
- **Stats recent activity**: Used Supabase FK joins (`user:users(name)`, `course:courses(title)`) instead of Prisma includes
- **Stats distributions**: Used `supabaseAdmin.from('users').select('role:roles(name)')` with manual counting (same pattern as original)
- **CamelCase mapping**: Added `snakeToCamel` + `mapToCamelCase` utility in stats route for recursive snake_case→camelCase conversion on recent activity data
- **User response format**: Role is mapped from nested `{ id, name }` object to plain string name for frontend compatibility

## Verification
- Lint: 0 errors
- Dev server: running correctly
