-- ============================================
-- JUSKOE Database Schema (v2 — Production)
-- Supabase PostgreSQL
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES TABLE (was "users")
-- The app code queries "profiles" throughout
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),

  -- Usage tracking (daily)
  daily_ai_used INTEGER NOT NULL DEFAULT 0,
  daily_grammar_used INTEGER NOT NULL DEFAULT 0,
  monthly_used INTEGER NOT NULL DEFAULT 0,
  last_usage_reset DATE NOT NULL DEFAULT CURRENT_DATE,
  last_monthly_reset DATE NOT NULL DEFAULT (date_trunc('month', CURRENT_DATE)::date),

  -- Productivity stats
  total_words INTEGER NOT NULL DEFAULT 0,
  avg_wpm INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_active TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. TRIGGER: Auto-create profile on signup
-- Captures full_name + avatar from user_metadata
-- (works for email signup AND Google OAuth)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture',
      ''
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger if it exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 3. CLOUD DICTIONARY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.cloud_dictionary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  correction TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, word)
);

CREATE INDEX IF NOT EXISTS cloud_dictionary_user_id_idx ON public.cloud_dictionary(user_id);

-- ============================================
-- 4. CLOUD SNIPPETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.cloud_snippets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, key)
);

CREATE INDEX IF NOT EXISTS cloud_snippets_user_id_idx ON public.cloud_snippets(user_id);

-- ============================================
-- 5. CLOUD NOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.cloud_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cloud_notes_user_id_idx ON public.cloud_notes(user_id);
CREATE INDEX IF NOT EXISTS cloud_notes_created_at_idx ON public.cloud_notes(created_at DESC);

-- ============================================
-- 6. SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'pro' CHECK (plan IN ('pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
  razorpay_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions(user_id);

-- ============================================
-- 7. SNIPPETS TABLE (local writing personas)
-- ============================================
CREATE TABLE IF NOT EXISTS public.snippets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  type TEXT DEFAULT 'phrase' CHECK (type IN ('contact', 'phrase', 'word')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, key)
);

CREATE INDEX IF NOT EXISTS snippets_user_id_idx ON public.snippets(user_id);

-- ============================================
-- 8. ROLES TABLE (writing personas)
-- ============================================
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS roles_user_id_idx ON public.roles(user_id);

-- Default roles for new users
CREATE OR REPLACE FUNCTION public.create_default_roles()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.roles (user_id, name, prompt, is_default) VALUES
    (NEW.id, 'Professional', 'Write in a formal, professional business tone.', TRUE),
    (NEW.id, 'Casual', 'Write in a friendly, conversational tone.', TRUE),
    (NEW.id, 'Academic', 'Write in an academic, scholarly style.', TRUE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_roles ON public.profiles;
CREATE TRIGGER on_user_created_roles
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_default_roles();

-- ============================================
-- 9. LOGS TABLE (usage analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS public.logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  mode TEXT CHECK (mode IN ('ai', 'grammar')),
  latency_ms INTEGER,
  input_length INTEGER,
  output_length INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS logs_user_id_idx ON public.logs(user_id);
CREATE INDEX IF NOT EXISTS logs_created_at_idx ON public.logs(created_at DESC);

-- ============================================
-- 10. ROW LEVEL SECURITY (RLS)
-- Every table must have RLS enabled + policies
-- ============================================

-- Enable RLS on ALL tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_dictionary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- ---- Profiles ----
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
-- No INSERT policy needed — the SECURITY DEFINER trigger handles it
-- No DELETE policy — users cannot self-delete (admin only)

-- ---- Cloud Dictionary ----
CREATE POLICY "cloud_dict_select_own" ON public.cloud_dictionary
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cloud_dict_insert_own" ON public.cloud_dictionary
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cloud_dict_update_own" ON public.cloud_dictionary
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cloud_dict_delete_own" ON public.cloud_dictionary
  FOR DELETE USING (auth.uid() = user_id);

-- ---- Cloud Snippets ----
CREATE POLICY "cloud_snippets_select_own" ON public.cloud_snippets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cloud_snippets_insert_own" ON public.cloud_snippets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cloud_snippets_update_own" ON public.cloud_snippets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cloud_snippets_delete_own" ON public.cloud_snippets
  FOR DELETE USING (auth.uid() = user_id);

-- ---- Cloud Notes ----
CREATE POLICY "cloud_notes_select_own" ON public.cloud_notes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cloud_notes_insert_own" ON public.cloud_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cloud_notes_update_own" ON public.cloud_notes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cloud_notes_delete_own" ON public.cloud_notes
  FOR DELETE USING (auth.uid() = user_id);

-- ---- Subscriptions ----
CREATE POLICY "subs_select_own" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);
-- INSERT/UPDATE/DELETE for subscriptions is admin/server-only (no user policy)

-- ---- Snippets ----
CREATE POLICY "snippets_select_own" ON public.snippets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "snippets_insert_own" ON public.snippets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "snippets_update_own" ON public.snippets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "snippets_delete_own" ON public.snippets
  FOR DELETE USING (auth.uid() = user_id);

-- ---- Roles ----
CREATE POLICY "roles_select_own" ON public.roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "roles_insert_own" ON public.roles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "roles_update_own" ON public.roles
  FOR UPDATE USING (auth.uid() = user_id AND is_default = FALSE);
CREATE POLICY "roles_delete_own" ON public.roles
  FOR DELETE USING (auth.uid() = user_id AND is_default = FALSE);

-- ---- Logs ----
CREATE POLICY "logs_select_own" ON public.logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "logs_insert_own" ON public.logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- No UPDATE/DELETE for logs (append-only audit trail)

-- ============================================
-- 11. RPC: increment_usage
-- Called before each AI/Grammar operation
-- Auto-resets daily/monthly counters as needed
-- Returns { allowed, reason, plan }
-- ============================================
CREATE OR REPLACE FUNCTION public.increment_usage(p_mode TEXT)
RETURNS JSON AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_daily_limit INTEGER;
  v_monthly_limit INTEGER;
  v_current_daily INTEGER;
BEGIN
  -- Get profile (caller must be authenticated — RLS will enforce)
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN json_build_object('allowed', false, 'reason', 'Profile not found', 'plan', 'free');
  END IF;

  -- Auto-reset daily counters if new day
  IF v_profile.last_usage_reset < CURRENT_DATE THEN
    UPDATE public.profiles SET
      daily_ai_used = 0,
      daily_grammar_used = 0,
      last_usage_reset = CURRENT_DATE
    WHERE id = auth.uid();
    v_profile.daily_ai_used := 0;
    v_profile.daily_grammar_used := 0;
  END IF;

  -- Auto-reset monthly counter if new month
  IF v_profile.last_monthly_reset < date_trunc('month', CURRENT_DATE)::date THEN
    UPDATE public.profiles SET
      monthly_used = 0,
      last_monthly_reset = date_trunc('month', CURRENT_DATE)::date
    WHERE id = auth.uid();
    v_profile.monthly_used := 0;
  END IF;

  -- Pro users: always allowed
  IF v_profile.plan = 'pro' OR v_profile.plan = 'enterprise' THEN
    -- Still track usage for analytics
    IF p_mode = 'ai' THEN
      UPDATE public.profiles SET daily_ai_used = daily_ai_used + 1, monthly_used = monthly_used + 1 WHERE id = auth.uid();
    ELSIF p_mode = 'grammar' THEN
      UPDATE public.profiles SET daily_grammar_used = daily_grammar_used + 1, monthly_used = monthly_used + 1 WHERE id = auth.uid();
    ELSE
      UPDATE public.profiles SET monthly_used = monthly_used + 1 WHERE id = auth.uid();
    END IF;
    RETURN json_build_object('allowed', true, 'plan', v_profile.plan);
  END IF;

  -- Free plan limits
  IF p_mode = 'ai' THEN
    v_daily_limit := 10;
    v_current_daily := v_profile.daily_ai_used;
  ELSIF p_mode = 'grammar' THEN
    v_daily_limit := 15;
    v_current_daily := v_profile.daily_grammar_used;
  ELSE
    v_daily_limit := 25;
    v_current_daily := v_profile.daily_ai_used + v_profile.daily_grammar_used;
  END IF;
  v_monthly_limit := 200;

  -- Check daily limit
  IF v_current_daily >= v_daily_limit THEN
    RETURN json_build_object('allowed', false, 'reason', 'Daily limit reached', 'plan', 'free');
  END IF;

  -- Check monthly limit
  IF v_profile.monthly_used >= v_monthly_limit THEN
    RETURN json_build_object('allowed', false, 'reason', 'Monthly limit reached', 'plan', 'free');
  END IF;

  -- Increment
  IF p_mode = 'ai' THEN
    UPDATE public.profiles SET daily_ai_used = daily_ai_used + 1, monthly_used = monthly_used + 1 WHERE id = auth.uid();
  ELSIF p_mode = 'grammar' THEN
    UPDATE public.profiles SET daily_grammar_used = daily_grammar_used + 1, monthly_used = monthly_used + 1 WHERE id = auth.uid();
  ELSE
    UPDATE public.profiles SET monthly_used = monthly_used + 1 WHERE id = auth.uid();
  END IF;

  RETURN json_build_object('allowed', true, 'plan', 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 12. RPC: get_usage_summary
-- Returns current usage counters for the caller
-- Auto-resets if day/month has changed
-- ============================================
CREATE OR REPLACE FUNCTION public.get_usage_summary()
RETURNS JSON AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN json_build_object('daily_ai', 0, 'daily_grammar', 0, 'monthly_total', 0, 'limit_reached', false);
  END IF;

  -- Auto-reset daily if new day
  IF v_profile.last_usage_reset < CURRENT_DATE THEN
    UPDATE public.profiles SET
      daily_ai_used = 0,
      daily_grammar_used = 0,
      last_usage_reset = CURRENT_DATE
    WHERE id = auth.uid();
    v_profile.daily_ai_used := 0;
    v_profile.daily_grammar_used := 0;
  END IF;

  -- Auto-reset monthly if new month
  IF v_profile.last_monthly_reset < date_trunc('month', CURRENT_DATE)::date THEN
    UPDATE public.profiles SET
      monthly_used = 0,
      last_monthly_reset = date_trunc('month', CURRENT_DATE)::date
    WHERE id = auth.uid();
    v_profile.monthly_used := 0;
  END IF;

  RETURN json_build_object(
    'daily_ai', v_profile.daily_ai_used,
    'daily_grammar', v_profile.daily_grammar_used,
    'monthly_total', v_profile.monthly_used,
    'limit_reached', (
      v_profile.plan = 'free' AND (
        v_profile.daily_ai_used >= 10 OR
        v_profile.daily_grammar_used >= 15 OR
        v_profile.monthly_used >= 200
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 13. Helper: update_user_stats
-- Used by productivity tracking
-- ============================================
CREATE OR REPLACE FUNCTION public.update_user_stats(
  p_user_id UUID,
  p_words INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET
    total_words = total_words + p_words,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 14. Helper: get_user_stats
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_words', total_words,
    'streak_days', streak_days,
    'avg_wpm', avg_wpm,
    'logs_today', (
      SELECT COUNT(*) FROM public.logs
      WHERE user_id = p_user_id
      AND created_at > NOW() - INTERVAL '1 day'
    ),
    'average_latency', (
      SELECT COALESCE(AVG(latency_ms), 0) FROM public.logs
      WHERE user_id = p_user_id
      AND created_at > NOW() - INTERVAL '7 days'
    )
  ) INTO result
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
