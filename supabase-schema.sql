-- WEDS (Week-End School Digital) - Supabase Database Schema
-- Run this SQL in the Supabase Dashboard SQL Editor to create all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== CORE: USER & AUTH ====================

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

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

-- ==================== E-LEARNING ====================

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

CREATE TABLE IF NOT EXISTS course_modules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  description TEXT,
  "order" INTEGER DEFAULT 0,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  lesson_id TEXT UNIQUE NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  answer INTEGER NOT NULL,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_results (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS lesson_progress (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id),
  lesson_id TEXT NOT NULL REFERENCES lessons(id),
  completed BOOLEAN DEFAULT false,
  time_spent INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  qr_code TEXT,
  issued_at TIMESTAMPTZ DEFAULT now(),
  user_id TEXT NOT NULL REFERENCES users(id),
  enrollment_id TEXT UNIQUE NOT NULL REFERENCES enrollments(id)
);

CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id),
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id),
  status TEXT DEFAULT 'pending',
  cover_letter TEXT,
  applied_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== MENTORSHIP ====================

CREATE TABLE IF NOT EXISTS mentors (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id),
  expertise TEXT NOT NULL,
  availability TEXT NOT NULL,
  experience TEXT,
  rating DOUBLE PRECISION DEFAULT 0,
  accept_requests BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mentor_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  mentee_id TEXT NOT NULL REFERENCES users(id),
  mentor_id TEXT NOT NULL REFERENCES mentors(id),
  message TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== COMMUNITY ====================

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

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  content TEXT NOT NULL,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS likes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id),
  group_id TEXT NOT NULL REFERENCES groups(id),
  role TEXT DEFAULT 'member',
  UNIQUE(user_id, group_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  content TEXT NOT NULL,
  sender_id TEXT NOT NULL REFERENCES users(id),
  receiver_id TEXT NOT NULL REFERENCES users(id),
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== ALERTS & SOS ====================

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

CREATE TABLE IF NOT EXISTS report_attachments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  url TEXT NOT NULL,
  type TEXT NOT NULL,
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

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
  assigned_admin_id TEXT REFERENCES users(id),
  fallback_admin_id TEXT REFERENCES users(id),
  call_id TEXT,
  escalation_level INTEGER DEFAULT 0,
  auto_triggered BOOLEAN DEFAULT false,
  offline_stored BOOLEAN DEFAULT false,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS sos_gps_updates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  alert_id TEXT NOT NULL REFERENCES sos_alerts(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  "timestamp" TIMESTAMPTZ DEFAULT now()
);

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

-- ==================== CHATBOT ====================

CREATE TABLE IF NOT EXISTS chatbot_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  language TEXT DEFAULT 'fr',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== ADMIN ====================

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
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
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_courses_published ON courses(published);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_user_id ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_pinned ON community_posts(pinned);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_user_id ON sos_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_status ON sos_alerts(status);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_assigned_admin ON sos_alerts(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);

-- ==================== ENABLE RLS (Row Level Security) ====================
-- We use the service role key in the backend, so RLS is bypassed.
-- But we enable RLS and create policies for direct client access.

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_gps_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;

-- Allow public read access to published courses and opportunities
CREATE POLICY "Published courses are readable by everyone" ON courses FOR SELECT USING (published = true);
CREATE POLICY "Published opportunities are readable by everyone" ON opportunities FOR SELECT USING (published = true);
CREATE POLICY "Roles are readable by everyone" ON roles FOR SELECT USING (true);
CREATE POLICY "Badges are readable by everyone" ON badges FOR SELECT USING (true);
CREATE POLICY "Groups are readable by everyone" ON groups FOR SELECT USING (true);
CREATE POLICY "Mentors accepting requests are readable by everyone" ON mentors FOR SELECT USING (accept_requests = true);
CREATE POLICY "Community posts are readable by everyone" ON community_posts FOR SELECT USING (true);
CREATE POLICY "Comments are readable by everyone" ON comments FOR SELECT USING (true);
CREATE POLICY "SOS admins list is public" ON users FOR SELECT USING (is_active = true);

-- Allow anonymous SOS alert creation
CREATE POLICY "Anyone can create SOS alerts" ON sos_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can create SOS call logs" ON sos_call_logs FOR INSERT WITH CHECK (true);

-- Users can read their own data
CREATE POLICY "Users can read own data" ON users FOR SELECT USING (auth.uid()::text = id);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid()::text = id);
CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can read own enrollments" ON enrollments FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can read own messages" ON messages FOR SELECT USING (auth.uid()::text IN (sender_id, receiver_id));

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_mentors_updated_at BEFORE UPDATE ON mentors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_mentor_requests_updated_at BEFORE UPDATE ON mentor_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_community_posts_updated_at BEFORE UPDATE ON community_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_sos_alerts_updated_at BEFORE UPDATE ON sos_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_sos_interventions_updated_at BEFORE UPDATE ON sos_interventions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==================== SEED DATA ====================

-- Insert roles
INSERT INTO roles (name, description) VALUES ('SUPER_ADMIN', 'Super administrateur avec accès complet') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description) VALUES ('ADMIN', 'Administrateur de la plateforme') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description) VALUES ('MODERATEUR', 'Modérateur de la communauté') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description) VALUES ('FORMATEUR', 'Formateur et créateur de cours') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description) VALUES ('MENTOR', 'Mentor pour les membres') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description) VALUES ('VOLONTAIRE', 'Volontaire communautaire') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description) VALUES ('UTILISATEUR', 'Utilisateur par défaut') ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, description) VALUES ('INTERVENANT_URGENCE', 'Intervenant d''urgence SOS') ON CONFLICT (name) DO NOTHING;
