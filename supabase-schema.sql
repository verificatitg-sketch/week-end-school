-- ==================== WEDS - Week-End School Digital ====================
-- Supabase Database Schema
-- Run this SQL in Supabase SQL Editor

-- ==================== ROLES ====================
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== USERS ====================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  phone TEXT,
  avatar TEXT,
  bio TEXT,
  date_of_birth TEXT,
  gender TEXT,
  disability TEXT,
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  role_id TEXT REFERENCES roles(id),
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  language TEXT DEFAULT 'fr',
  font_size TEXT DEFAULT 'normal',
  high_contrast BOOLEAN DEFAULT false,
  screen_reader BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== COURSES ====================
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  level TEXT DEFAULT 'beginner',
  thumbnail TEXT,
  duration INTEGER DEFAULT 0,
  rating DOUBLE PRECISION DEFAULT 0,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== COURSE MODULES ====================
CREATE TABLE IF NOT EXISTS course_modules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  description TEXT,
  "order" INTEGER DEFAULT 0,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== LESSONS ====================
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  content TEXT,
  video_url TEXT,
  audio_url TEXT,
  pdf_url TEXT,
  "order" INTEGER DEFAULT 0,
  module_id TEXT NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== QUIZZES ====================
CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  lesson_id TEXT UNIQUE NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== QUIZ QUESTIONS ====================
CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  answer INTEGER NOT NULL,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== QUIZ RESULTS ====================
CREATE TABLE IF NOT EXISTS quiz_results (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== ENROLLMENTS ====================
CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id),
  course_id TEXT NOT NULL REFERENCES courses(id),
  progress DOUBLE PRECISION DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- ==================== LESSON PROGRESS ====================
CREATE TABLE IF NOT EXISTS lesson_progress (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id),
  lesson_id TEXT NOT NULL REFERENCES lessons(id),
  completed BOOLEAN DEFAULT false,
  time_spent INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- ==================== CERTIFICATES ====================
CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  qr_code TEXT,
  issued_at TIMESTAMPTZ DEFAULT now(),
  user_id TEXT NOT NULL REFERENCES users(id),
  enrollment_id TEXT UNIQUE NOT NULL REFERENCES enrollments(id)
);

-- ==================== BADGES ====================
CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== USER BADGES ====================
CREATE TABLE IF NOT EXISTS user_badges (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id),
  badge_id TEXT NOT NULL REFERENCES badges(id),
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- ==================== OPPORTUNITIES ====================
CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  organization TEXT,
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  deadline TEXT,
  salary TEXT,
  requirements TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  url TEXT,
  published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== APPLICATIONS ====================
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id),
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id),
  status TEXT DEFAULT 'pending',
  cover_letter TEXT,
  applied_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== MENTORS ====================
CREATE TABLE IF NOT EXISTS mentors (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id),
  expertise TEXT NOT NULL,
  availability TEXT NOT NULL,
  experience TEXT,
  rating DOUBLE PRECISION DEFAULT 0,
  accept_requests BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== MENTOR REQUESTS ====================
CREATE TABLE IF NOT EXISTS mentor_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  mentee_id TEXT NOT NULL REFERENCES users(id),
  mentor_id TEXT NOT NULL REFERENCES mentors(id),
  message TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== COMMUNITY POSTS ====================
CREATE TABLE IF NOT EXISTS community_posts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  user_id TEXT NOT NULL REFERENCES users(id),
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== COMMENTS ====================
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  content TEXT NOT NULL,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== LIKES ====================
CREATE TABLE IF NOT EXISTS likes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  UNIQUE(post_id, user_id)
);

-- ==================== GROUPS ====================
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== GROUP MEMBERS ====================
CREATE TABLE IF NOT EXISTS group_members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id),
  group_id TEXT NOT NULL REFERENCES groups(id),
  role TEXT DEFAULT 'member',
  UNIQUE(user_id, group_id)
);

-- ==================== MESSAGES ====================
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  content TEXT NOT NULL,
  sender_id TEXT NOT NULL REFERENCES users(id),
  receiver_id TEXT NOT NULL REFERENCES users(id),
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== REPORTS ====================
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  anonymous BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending',
  severity TEXT DEFAULT 'medium',
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== REPORT ATTACHMENTS ====================
CREATE TABLE IF NOT EXISTS report_attachments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  url TEXT NOT NULL,
  type TEXT NOT NULL,
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== SOS ALERTS ====================
CREATE TABLE IF NOT EXISTS sos_alerts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES users(id),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT,
  urgency_level TEXT DEFAULT 'high',
  status TEXT DEFAULT 'received',
  silent_mode BOOLEAN DEFAULT false,
  description TEXT,
  caller_phone TEXT,
  caller_name TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  battery_level DOUBLE PRECISION,
  is_charging BOOLEAN,
  network_status TEXT,
  connection_type TEXT,
  session_id TEXT,
  assigned_admin_id TEXT,
  fallback_admin_id TEXT,
  call_id TEXT,
  escalation_level INTEGER DEFAULT 0,
  auto_triggered BOOLEAN DEFAULT false,
  offline_stored BOOLEAN DEFAULT false,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== SOS INTERVENTIONS ====================
CREATE TABLE IF NOT EXISTS sos_interventions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  alert_id TEXT NOT NULL REFERENCES sos_alerts(id),
  responder_id TEXT NOT NULL REFERENCES users(id),
  status TEXT DEFAULT 'dispatched',
  role TEXT DEFAULT 'primary',
  notes TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== SOS GPS UPDATES ====================
CREATE TABLE IF NOT EXISTS sos_gps_updates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  alert_id TEXT NOT NULL REFERENCES sos_alerts(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- ==================== SOS CALL LOGS ====================
CREATE TABLE IF NOT EXISTS sos_call_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  alert_id TEXT NOT NULL REFERENCES sos_alerts(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== NOTIFICATIONS ====================
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== CHATBOT LOGS ====================
CREATE TABLE IF NOT EXISTS chatbot_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  language TEXT DEFAULT 'fr',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== AUDIT LOGS ====================
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== SETTINGS ====================
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== GEOGRAPHY ====================
CREATE TABLE IF NOT EXISTS regions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS districts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  region_id TEXT NOT NULL REFERENCES regions(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS communities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  district_id TEXT NOT NULL REFERENCES districts(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_user ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_user ON sos_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_status ON sos_alerts(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- ==================== ENABLE RLS (Row Level Security) ====================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_requests ENABLE ROW LEVEL SECURITY;

-- ==================== RLS POLICIES ====================
-- Allow service role full access (backend)
CREATE POLICY "Service role full access on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on courses" ON courses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on enrollments" ON enrollments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on community_posts" ON community_posts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on sos_alerts" ON sos_alerts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on reports" ON reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on opportunities" ON opportunities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on mentor_requests" ON mentor_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on roles" ON roles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on course_modules" ON course_modules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on lessons" ON lessons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on quizzes" ON quizzes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on quiz_questions" ON quiz_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on quiz_results" ON quiz_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on lesson_progress" ON lesson_progress FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on certificates" ON certificates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on badges" ON badges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on user_badges" ON user_badges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on applications" ON applications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on mentors" ON mentors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on comments" ON comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on likes" ON likes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on groups" ON groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on group_members" ON group_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on messages" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on report_attachments" ON report_attachments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on sos_interventions" ON sos_interventions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on sos_gps_updates" ON sos_gps_updates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on sos_call_logs" ON sos_call_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on chatbot_logs" ON chatbot_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on audit_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on settings" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on regions" ON regions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on districts" ON districts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on communities" ON communities FOR ALL USING (true) WITH CHECK (true);

-- ==================== SEED DATA ====================
-- Roles
INSERT INTO roles (name, description) VALUES ('SUPER_ADMIN', 'Role: SUPER_ADMIN') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description) VALUES ('ADMIN', 'Role: ADMIN') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description) VALUES ('MODERATEUR', 'Role: MODERATEUR') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description) VALUES ('FORMATEUR', 'Role: FORMATEUR') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description) VALUES ('MENTOR', 'Role: MENTOR') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description) VALUES ('VOLONTAIRE', 'Role: VOLONTAIRE') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description) VALUES ('UTILISATEUR', 'Role: UTILISATEUR') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description) VALUES ('INTERVENANT_URGENCE', 'Role: INTERVENANT_URGENCE') ON CONFLICT (name) DO NOTHING;

-- NOTE: Admin user will be created via the seed API (password needs bcrypt hashing)
