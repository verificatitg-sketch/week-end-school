# Task 4 - Supabase Auth Migration

## Task
Migrate 3 auth API routes from Prisma/SQLite to Supabase.

## Files Modified
1. `/src/app/api/auth/login/route.ts` - Replaced Prisma db calls with Supabase sb helpers + mapUserToApi
2. `/src/app/api/auth/register/route.ts` - Replaced Prisma db calls with sb.user/sb.role helpers + mapUserToDb + mapUserToApi
3. `/src/app/api/auth/me/route.ts` - Replaced single Prisma findUnique with 3 separate Supabase queries (user+role, badges, mentor) + manual camelCase mapping

## Key Decisions
- Used `sb.user.findUnique({ email })` which already includes role relation (no separate include needed)
- For the `me` endpoint, Supabase doesn't support Prisma's deep nested includes, so badges and mentorProfile are fetched separately
- Badge and mentor profile fields are manually mapped from snake_case to camelCase to maintain frontend compatibility
- The `mapUserToApi()` function handles user+role transformation; badges and mentorProfile are added on top
- `is_active` (snake_case) used for DB-level check in login instead of Prisma's `isActive`

## Verification
- Lint: 0 errors
- Dev server: running correctly
