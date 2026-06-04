import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client-side Supabase (anonymous key - safe for browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase (service role key - bypasses RLS, backend only)
export const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Default export for backward compatibility
export default supabase;

// ==================== Helper Types ====================

export interface DbUser {
  id: string;
  email: string;
  name: string;
  password: string;
  phone: string | null;
  avatar: string | null;
  bio: string | null;
  date_of_birth: string | null;
  gender: string | null;
  disability: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  role_id: string | null;
  is_active: boolean;
  is_verified: boolean;
  language: string;
  font_size: string;
  high_contrast: boolean;
  screen_reader: boolean;
  created_at: string;
  updated_at: string;
  role?: DbRole | null;
}

export interface DbRole {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

// ==================== Supabase DB Helper ====================

/**
 * Wrapper around Supabase admin client that provides Prisma-like query patterns.
 * Uses the service role key to bypass RLS.
 */
export const sb = {
  // ==================== Roles ====================
  role: {
    findUnique: async (where: { id?: string; name?: string }) => {
      let query = supabaseAdmin.from('roles').select('*');
      if (where.id) query = query.eq('id', where.id);
      if (where.name) query = query.eq('name', where.name);
      const { data, error } = await query.single();
      if (error && error.code === 'PGRST116') return null; // not found
      if (error) throw error;
      return data as DbRole;
    },
    findMany: async (where?: Record<string, unknown>) => {
      let query = supabaseAdmin.from('roles').select('*');
      if (where?.name && Array.isArray(where.name)) {
        const { in: values } = where.name.reduce<{ in: string[] }>((acc, _: unknown) => acc, { in: where.name as string[] });
        query = query.in('name', values);
      } else if (where?.name) {
        query = query.eq('name', where.name as string);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as DbRole[];
    },
    upsert: async (where: { name: string }, update: Partial<DbRole>, create: Omit<DbRole, 'id' | 'created_at'>) => {
      // Check if exists
      const existing = await sb.role.findUnique({ name: where.name });
      if (existing) return existing;
      // Create new
      const { data, error } = await supabaseAdmin.from('roles').insert(create).select().single();
      if (error) throw error;
      return data as DbRole;
    },
    create: async (data: Omit<DbRole, 'id' | 'created_at'>) => {
      const { data: result, error } = await supabaseAdmin.from('roles').insert(data).select().single();
      if (error) throw error;
      return result as DbRole;
    },
  },

  // ==================== Users ====================
  user: {
    findUnique: async (where: { id?: string; email?: string }) => {
      let query = supabaseAdmin.from('users').select('*, role:roles(*)');
      if (where.id) query = query.eq('id', where.id);
      if (where.email) query = query.eq('email', where.email);
      const { data, error } = await query.single();
      if (error && error.code === 'PGRST116') return null;
      if (error) throw error;
      return data as DbUser;
    },
    findMany: async (options?: {
      where?: Record<string, unknown>;
      select?: string;
      orderBy?: { column: string; asc?: boolean };
      limit?: number;
      offset?: number;
    }) => {
      let query = supabaseAdmin.from('users').select(options?.select || '*, role:roles(*)');

      if (options?.where) {
        for (const [key, value] of Object.entries(options.where)) {
          if (key === 'OR') {
            // Handle OR conditions - need to use filter
            const orConditions = value as Array<Record<string, unknown>>;
            const orString = orConditions.map(cond => {
              const [k, v] = Object.entries(cond)[0];
              if (typeof v === 'object' && v !== null && 'contains' in (v as Record<string, unknown>)) {
                return `${k}.ilike.%${(v as Record<string, unknown>).contains}%`;
              }
              return `${k}.eq.${v}`;
            }).join(',');
            query = query.or(orString);
          } else if (key === 'role') {
            const roleFilter = value as Record<string, unknown>;
            if (roleFilter.name) {
              query = query.eq('role.name', roleFilter.name as string);
            }
          } else if (key === 'role_id' && Array.isArray(value)) {
            query = query.in('role_id', value as string[]);
          } else if (typeof value === 'object' && value !== null && 'contains' in (value as Record<string, unknown>)) {
            query = query.ilike(key, `%${(value as Record<string, unknown>).contains}%`);
          } else if (key === 'is_active') {
            query = query.eq('is_active', value as boolean);
          } else {
            query = query.eq(key, value as string | number | boolean);
          }
        }
      }

      if (options?.orderBy) {
        query = query.order(options.orderBy.column, { ascending: options.orderBy.asc ?? true });
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DbUser[];
    },
    count: async (where?: Record<string, unknown>) => {
      let query = supabaseAdmin.from('users').select('*', { count: 'exact', head: true });
      if (where) {
        for (const [key, value] of Object.entries(where)) {
          if (key === 'role_id' && Array.isArray(value)) {
            query = query.in('role_id', value as string[]);
          } else if (typeof value === 'object' && value !== null) {
            // Skip complex filters for count
          } else {
            query = query.eq(key, value as string | number | boolean);
          }
        }
      }
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    create: async (data: Record<string, unknown>) => {
      const { data: result, error } = await supabaseAdmin.from('users').insert(data).select('*, role:roles(*)').single();
      if (error) throw error;
      return result as DbUser;
    },
    update: async (where: { id: string }, data: Record<string, unknown>) => {
      const { data: result, error } = await supabaseAdmin.from('users').update(data).eq('id', where.id).select('*, role:roles(*)').single();
      if (error) throw error;
      return result as DbUser;
    },
    delete: async (where: { id: string }) => {
      const { error } = await supabaseAdmin.from('users').delete().eq('id', where.id);
      if (error) throw error;
    },
  },

  // ==================== Courses ====================
  course: {
    findUnique: async (where: { id: string }, select?: string) => {
      const { data, error } = await supabaseAdmin.from('courses').select(select || '*').eq('id', where.id).single();
      if (error && error.code === 'PGRST116') return null;
      if (error) throw error;
      return data;
    },
    findMany: async (options?: {
      where?: Record<string, unknown>;
      select?: string;
      orderBy?: { column: string; asc?: boolean };
      limit?: number;
      offset?: number;
    }) => {
      let query = supabaseAdmin.from('courses').select(options?.select || '*');

      if (options?.where) {
        for (const [key, value] of Object.entries(options.where)) {
          if (typeof value === 'object' && value !== null && 'contains' in (value as Record<string, unknown>)) {
            query = query.ilike(key, `%${(value as Record<string, unknown>).contains}%`);
          } else {
            query = query.eq(key, value as string | number | boolean);
          }
        }
      }

      if (options?.orderBy) {
        query = query.order(options.orderBy.column, { ascending: options.orderBy.asc ?? true });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    count: async (where?: Record<string, unknown>) => {
      let query = supabaseAdmin.from('courses').select('*', { count: 'exact', head: true });
      if (where) {
        for (const [key, value] of Object.entries(where)) {
          query = query.eq(key, value as string | number | boolean);
        }
      }
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    create: async (data: Record<string, unknown>) => {
      const { data: result, error } = await supabaseAdmin.from('courses').insert(data).select().single();
      if (error) throw error;
      return result;
    },
    update: async (where: { id: string }, data: Record<string, unknown>) => {
      const { data: result, error } = await supabaseAdmin.from('courses').update(data).eq('id', where.id).select().single();
      if (error) throw error;
      return result;
    },
  },

  // ==================== Generic table helpers ====================
  from: (table: string) => supabaseAdmin.from(table),
};

/**
 * Map database user (snake_case) to API response (camelCase)
 */
export function mapUserToApi(dbUser: DbUser) {
  if (!dbUser) return null;
  const { role_id, is_active, is_verified, date_of_birth, font_size, high_contrast, screen_reader, created_at, updated_at, ...rest } = dbUser;
  return {
    ...rest,
    roleId: role_id,
    isActive: is_active,
    isVerified: is_verified,
    dateOfBirth: date_of_birth,
    fontSize: font_size,
    highContrast: high_contrast,
    screenReader: screen_reader,
    createdAt: created_at,
    updatedAt: updated_at,
    role: dbUser.role ? { id: dbUser.role.id, name: dbUser.role.name, description: dbUser.role.description } : null,
  };
}

/**
 * Map API input (camelCase) to database insert (snake_case)
 */
export function mapUserToDb(data: Record<string, unknown>) {
  const mapped: Record<string, unknown> = {};
  const fieldMap: Record<string, string> = {
    roleId: 'role_id',
    isActive: 'is_active',
    isVerified: 'is_verified',
    dateOfBirth: 'date_of_birth',
    fontSize: 'font_size',
    highContrast: 'high_contrast',
    screenReader: 'screen_reader',
    callerPhone: 'caller_phone',
    callerName: 'caller_name',
    isAnonymous: 'is_anonymous',
    batteryLevel: 'battery_level',
    isCharging: 'is_charging',
    networkStatus: 'network_status',
    connectionType: 'connection_type',
    sessionId: 'session_id',
    assignedAdminId: 'assigned_admin_id',
    fallbackAdminId: 'fallback_admin_id',
    callId: 'call_id',
    escalationLevel: 'escalation_level',
    autoTriggered: 'auto_triggered',
    offlineStored: 'offline_stored',
    syncedAt: 'synced_at',
    contactEmail: 'contact_email',
    contactPhone: 'contact_phone',
    userId: 'user_id',
    courseId: 'course_id',
    postId: 'post_id',
    mentorId: 'mentor_id',
    alertId: 'alert_id',
    responderId: 'responder_id',
    coverLetter: 'cover_letter',
    opportunityId: 'opportunity_id',
    enrollmentId: 'enrollment_id',
    lessonId: 'lesson_id',
    quizId: 'quiz_id',
    badgeId: 'badge_id',
    groupId: 'group_id',
    senderId: 'sender_id',
    receiverId: 'receiver_id',
    menteeId: 'mentee_id',
    qrCode: 'qr_code',
    actorId: 'actor_id',
  };

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    const dbKey = fieldMap[key] || key;
    mapped[dbKey] = value;
  }
  return mapped;
}
