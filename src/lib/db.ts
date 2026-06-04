import { createClient, type Client } from '@libsql/client';

// Turso database client - lazy initialization to ensure env vars are available
let _db: Client | null = null;

export function getDb(): Client {
  if (!_db) {
    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;
    if (!url || !token) {
      throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables are required');
    }
    _db = createClient({ url, authToken: token });
  }
  return _db;
}

// Lazy getter - only creates client when first accessed
export const db = new Proxy({} as Client, {
  get(_target, prop, receiver) {
    const actualDb = getDb();
    const value = Reflect.get(actualDb, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(actualDb);
    }
    return value;
  },
});

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
  is_active: number; // SQLite uses 0/1 for boolean
  is_verified: number;
  language: string;
  font_size: string;
  high_contrast: number;
  screen_reader: number;
  created_at: string;
  updated_at: string;
  role_name?: string;
  role_description?: string;
}

export interface DbRole {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

// ==================== DB Helpers ====================

export const turso = {
  // ==================== Roles ====================
  role: {
    findUnique: async (where: { id?: string; name?: string }): Promise<DbRole | null> => {
      try {
        if (where.id) {
          const res = await getDb().execute({ sql: 'SELECT * FROM roles WHERE id = ?', args: [where.id] });
          return res.rows[0] as unknown as DbRole || null;
        }
        if (where.name) {
          const res = await getDb().execute({ sql: 'SELECT * FROM roles WHERE name = ?', args: [where.name] });
          return res.rows[0] as unknown as DbRole || null;
        }
        return null;
      } catch { return null; }
    },
    findMany: async (where?: Record<string, unknown>): Promise<DbRole[]> => {
      try {
        let sql = 'SELECT * FROM roles';
        const args: unknown[] = [];
        if (where?.name) {
          if (Array.isArray(where.name)) {
            const placeholders = where.name.map(() => '?').join(',');
            sql += ` WHERE name IN (${placeholders})`;
            args.push(...where.name);
          } else {
            sql += ' WHERE name = ?';
            args.push(where.name);
          }
        }
        const res = await getDb().execute({ sql, args });
        return res.rows as unknown as DbRole[];
      } catch { return []; }
    },
    create: async (data: { name: string; description?: string }): Promise<DbRole | null> => {
      try {
        const id = crypto.randomUUID();
        await getDb().execute({
          sql: 'INSERT INTO roles (id, name, description) VALUES (?, ?, ?)',
          args: [id, data.name, data.description || null],
        });
        return turso.role.findUnique({ id });
      } catch { return null; }
    },
  },

  // ==================== Users ====================
  user: {
    findUnique: async (where: { id?: string; email?: string }): Promise<DbUser | null> => {
      try {
        if (where.email) {
          const res = await getDb().execute({
            sql: `SELECT u.*, r.name as role_name, r.description as role_description 
                   FROM users u LEFT JOIN roles r ON u.role_id = r.id 
                   WHERE u.email = ?`,
            args: [where.email],
          });
          return res.rows[0] as unknown as DbUser || null;
        }
        if (where.id) {
          const res = await getDb().execute({
            sql: `SELECT u.*, r.name as role_name, r.description as role_description 
                   FROM users u LEFT JOIN roles r ON u.role_id = r.id 
                   WHERE u.id = ?`,
            args: [where.id],
          });
          return res.rows[0] as unknown as DbUser || null;
        }
        return null;
      } catch { return null; }
    },
    findMany: async (options?: {
      where?: Record<string, unknown>;
      orderBy?: string;
      limit?: number;
      offset?: number;
    }): Promise<DbUser[]> => {
      try {
        let sql = `SELECT u.*, r.name as role_name, r.description as role_description 
                   FROM users u LEFT JOIN roles r ON u.role_id = r.id`;
        const args: unknown[] = [];
        const conditions: string[] = [];

        if (options?.where) {
          for (const [key, value] of Object.entries(options.where)) {
            if (key === 'OR') {
              const orConditions = value as Array<Record<string, unknown>>;
              const orStrings = orConditions.map(cond => {
                const [k, v] = Object.entries(cond)[0];
                if (typeof v === 'object' && v !== null && 'contains' in (v as Record<string, unknown>)) {
                  args.push(`%${(v as Record<string, unknown>).contains}%`);
                  return `u.${k} LIKE ?`;
                }
                args.push(v);
                return `u.${k} = ?`;
              });
              conditions.push(`(${orStrings.join(' OR ')})`);
            } else if (key === 'role' && typeof value === 'object' && value !== null) {
              const roleFilter = value as Record<string, unknown>;
              if (roleFilter.name) {
                args.push(roleFilter.name);
                conditions.push('r.name = ?');
              }
            } else if (key === 'role_id' && Array.isArray(value)) {
              const placeholders = value.map(() => '?').join(',');
              args.push(...value);
              conditions.push(`u.role_id IN (${placeholders})`);
            } else if (typeof value === 'object' && value !== null && 'contains' in (value as Record<string, unknown>)) {
              args.push(`%${(value as Record<string, unknown>).contains}%`);
              conditions.push(`u.${key} LIKE ?`);
            } else {
              args.push(value);
              conditions.push(`u.${key} = ?`);
            }
          }
        }

        if (conditions.length > 0) {
          sql += ' WHERE ' + conditions.join(' AND ');
        }

        if (options?.orderBy) {
          sql += ` ORDER BY ${options.orderBy}`;
        } else {
          sql += ' ORDER BY u.created_at DESC';
        }

        if (options?.limit) {
          sql += ' LIMIT ?';
          args.push(options.limit);
        }
        if (options?.offset) {
          sql += ' OFFSET ?';
          args.push(options.offset);
        }

        const res = await getDb().execute({ sql, args });
        return res.rows as unknown as DbUser[];
      } catch { return []; }
    },
    count: async (where?: Record<string, unknown>): Promise<number> => {
      try {
        let sql = 'SELECT COUNT(*) as count FROM users u';
        const args: unknown[] = [];
        const conditions: string[] = [];

        if (where) {
          if (where.role_id && Array.isArray(where.role_id)) {
            const placeholders = where.role_id.map(() => '?').join(',');
            args.push(...where.role_id);
            conditions.push(`u.role_id IN (${placeholders})`);
          }
          if (where.is_active !== undefined) {
            args.push(where.is_active ? 1 : 0);
            conditions.push('u.is_active = ?');
          }
        }

        if (conditions.length > 0) {
          sql += ' LEFT JOIN roles r ON u.role_id = r.id WHERE ' + conditions.join(' AND ');
        }

        const res = await getDb().execute({ sql, args });
        return (res.rows[0] as Record<string, unknown>)?.count as number || 0;
      } catch { return 0; }
    },
    create: async (data: Record<string, unknown>): Promise<DbUser | null> => {
      try {
        const id = crypto.randomUUID();
        const fields = ['id', ...Object.keys(data)];
        const values = [id, ...Object.values(data)];
        const placeholders = fields.map(() => '?').join(',');
        const fieldNames = fields.join(', ');

        await getDb().execute({
          sql: `INSERT INTO users (${fieldNames}) VALUES (${placeholders})`,
          args: values,
        });
        return turso.user.findUnique({ id });
      } catch { return null; }
    },
    update: async (where: { id: string }, data: Record<string, unknown>): Promise<DbUser | null> => {
      try {
        const setClauses = Object.keys(data).map(k => `${k} = ?`);
        const values = [...Object.values(data), where.id];
        await getDb().execute({
          sql: `UPDATE users SET ${setClauses.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
          args: values,
        });
        return turso.user.findUnique({ id: where.id });
      } catch { return null; }
    },
    delete: async (where: { id: string }): Promise<void> => {
      await getDb().execute({ sql: 'DELETE FROM users WHERE id = ?', args: [where.id] });
    },
  },

  // ==================== Courses ====================
  course: {
    findUnique: async (where: { id: string }) => {
      try {
        const res = await getDb().execute({ sql: 'SELECT * FROM courses WHERE id = ?', args: [where.id] });
        return res.rows[0] || null;
      } catch { return null; }
    },
    findMany: async (options?: {
      where?: Record<string, unknown>;
      orderBy?: string;
      limit?: number;
      offset?: number;
    }) => {
      try {
        let sql = 'SELECT * FROM courses';
        const args: unknown[] = [];
        const conditions: string[] = [];

        if (options?.where) {
          for (const [key, value] of Object.entries(options.where)) {
            if (typeof value === 'object' && value !== null && 'contains' in (value as Record<string, unknown>)) {
              args.push(`%${(value as Record<string, unknown>).contains}%`);
              conditions.push(`${key} LIKE ?`);
            } else {
              args.push(value);
              conditions.push(`${key} = ?`);
            }
          }
        }

        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
        sql += ` ORDER BY ${options?.orderBy || 'created_at DESC'}`;
        if (options?.limit) { sql += ' LIMIT ?'; args.push(options.limit); }
        if (options?.offset) { sql += ' OFFSET ?'; args.push(options.offset); }

        const res = await getDb().execute({ sql, args });
        return res.rows;
      } catch { return []; }
    },
    count: async (where?: Record<string, unknown>): Promise<number> => {
      try {
        let sql = 'SELECT COUNT(*) as count FROM courses';
        const args: unknown[] = [];
        const conditions: string[] = [];

        if (where) {
          for (const [key, value] of Object.entries(where)) {
            args.push(value);
            conditions.push(`${key} = ?`);
          }
        }
        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');

        const res = await getDb().execute({ sql, args });
        return (res.rows[0] as Record<string, unknown>)?.count as number || 0;
      } catch { return 0; }
    },
    create: async (data: Record<string, unknown>) => {
      try {
        const id = crypto.randomUUID();
        const fields = ['id', ...Object.keys(data)];
        const values = [id, ...Object.values(data)];
        await getDb().execute({
          sql: `INSERT INTO courses (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(',')})`,
          args: values,
        });
        return turso.course.findUnique({ id });
      } catch { return null; }
    },
    update: async (where: { id: string }, data: Record<string, unknown>) => {
      try {
        const setClauses = Object.keys(data).map(k => `${k} = ?`);
        const values = [...Object.values(data), where.id];
        await getDb().execute({
          sql: `UPDATE courses SET ${setClauses.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
          args: values,
        });
        return turso.course.findUnique({ id: where.id });
      } catch { return null; }
    },
    delete: async (where: { id: string }) => {
      await getDb().execute({ sql: 'DELETE FROM courses WHERE id = ?', args: [where.id] });
    },
  },

  // ==================== Generic query helpers ====================
  query: async (sql: string, args?: unknown[]) => {
    return db.execute({ sql, args: args || [] });
  },

  insert: async (table: string, data: Record<string, unknown>) => {
    const id = crypto.randomUUID();
    const fields = ['id', ...Object.keys(data)];
    const values = [id, ...Object.values(data)];
    await getDb().execute({
      sql: `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(',')})`,
      args: values,
    });
    return id;
  },

  update: async (table: string, where: { id: string }, data: Record<string, unknown>) => {
    const setClauses = Object.keys(data).map(k => `${k} = ?`);
    const values = [...Object.values(data), where.id];
    await getDb().execute({
      sql: `UPDATE ${table} SET ${setClauses.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
      args: values,
    });
  },

  delete: async (table: string, where: { id: string }) => {
    await getDb().execute({ sql: `DELETE FROM ${table} WHERE id = ?`, args: [where.id] });
  },

  findById: async (table: string, id: string) => {
    const res = await getDb().execute({ sql: `SELECT * FROM ${table} WHERE id = ?`, args: [id] });
    return res.rows[0] || null;
  },

  findMany: async (table: string, options?: {
    where?: Record<string, unknown>;
    orderBy?: string;
    limit?: number;
    offset?: number;
  }) => {
    let sql = `SELECT * FROM ${table}`;
    const args: unknown[] = [];
    const conditions: string[] = [];

    if (options?.where) {
      for (const [key, value] of Object.entries(options.where)) {
        if (typeof value === 'object' && value !== null && 'contains' in (value as Record<string, unknown>)) {
          args.push(`%${(value as Record<string, unknown>).contains}%`);
          conditions.push(`${key} LIKE ?`);
        } else {
          args.push(value);
          conditions.push(`${key} = ?`);
        }
      }
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ` ORDER BY ${options?.orderBy || 'created_at DESC'}`;
    if (options?.limit) { sql += ' LIMIT ?'; args.push(options.limit); }
    if (options?.offset) { sql += ' OFFSET ?'; args.push(options.offset); }

    const res = await getDb().execute({ sql, args });
    return res.rows;
  },

  count: async (table: string, where?: Record<string, unknown>): Promise<number> => {
    let sql = `SELECT COUNT(*) as count FROM ${table}`;
    const args: unknown[] = [];
    const conditions: string[] = [];

    if (where) {
      for (const [key, value] of Object.entries(where)) {
        args.push(value);
        conditions.push(`${key} = ?`);
      }
    }
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');

    const res = await getDb().execute({ sql, args });
    return (res.rows[0] as Record<string, unknown>)?.count as number || 0;
  },
};

/**
 * Map database user (snake_case) to API response (camelCase)
 */
export function mapUserToApi(dbUser: DbUser | null) {
  if (!dbUser) return null;
  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    phone: dbUser.phone,
    avatar: dbUser.avatar,
    bio: dbUser.bio,
    dateOfBirth: dbUser.date_of_birth,
    gender: dbUser.gender,
    disability: dbUser.disability,
    location: dbUser.location,
    latitude: dbUser.latitude,
    longitude: dbUser.longitude,
    roleId: dbUser.role_id,
    isActive: !!dbUser.is_active,
    isVerified: !!dbUser.is_verified,
    language: dbUser.language,
    fontSize: dbUser.font_size,
    highContrast: !!dbUser.high_contrast,
    screenReader: !!dbUser.screen_reader,
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at,
    role: dbUser.role_name ? { id: dbUser.role_id, name: dbUser.role_name, description: dbUser.role_description } : null,
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
    // Convert booleans to 0/1 for SQLite
    if (typeof value === 'boolean') {
      mapped[dbKey] = value ? 1 : 0;
    } else {
      mapped[dbKey] = value;
    }
  }
  return mapped;
}
