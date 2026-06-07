-- ============================================
-- JUSKOE — Supabase Database Schema
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT DEFAULT '',
    avatar_url TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
    subscription_status TEXT DEFAULT 'inactive',
    daily_usage_ai INTEGER DEFAULT 0,
    daily_usage_grammar INTEGER DEFAULT 0,
    monthly_usage_total INTEGER DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    total_words INTEGER DEFAULT 0,
    avg_wpm INTEGER DEFAULT 0,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
    razorpay_subscription_id TEXT,
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Cloud Dictionary
CREATE TABLE IF NOT EXISTS cloud_dictionary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    correction TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, word)
);

-- 4. Cloud Snippets
CREATE TABLE IF NOT EXISTS cloud_snippets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    title TEXT DEFAULT '',
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, key)
);

-- 5. Cloud Notes
CREATE TABLE IF NOT EXISTS cloud_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Usage Logs
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('ai', 'grammar', 'notes')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. App Config (secure, service_role only)
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Gemini key (run once — replace YOUR_GEMINI_KEY with actual key)
-- INSERT INTO app_config (key, value) VALUES ('gemini_api_key', 'YOUR_GEMINI_API_KEY')
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_dictionary ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update own
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Subscriptions: users read own
CREATE POLICY "Users read own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Cloud Dictionary: full CRUD on own
CREATE POLICY "Users manage own dictionary" ON cloud_dictionary FOR ALL USING (auth.uid() = user_id);

-- Cloud Snippets: full CRUD on own
CREATE POLICY "Users manage own snippets" ON cloud_snippets FOR ALL USING (auth.uid() = user_id);

-- Cloud Notes: full CRUD on own
CREATE POLICY "Users manage own notes" ON cloud_notes FOR ALL USING (auth.uid() = user_id);

-- Usage Logs: insert + read own
CREATE POLICY "Users insert own usage" ON usage_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own usage" ON usage_logs FOR SELECT USING (auth.uid() = user_id);

-- App Config: NO public access (service_role only)
-- No policies = denied for anon/authenticated users

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Reset daily usage (call from a scheduled job or on-demand)
CREATE OR REPLACE FUNCTION reset_daily_usage()
RETURNS void AS $$
BEGIN
    UPDATE profiles
    SET daily_ai_used = 0,
        daily_grammar_used = 0,
        last_usage_reset = CURRENT_DATE
    WHERE last_usage_reset < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset monthly usage
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void AS $$
BEGIN
    UPDATE profiles
    SET monthly_used = 0,
        last_monthly_reset = DATE_TRUNC('month', CURRENT_DATE)::DATE
    WHERE last_monthly_reset < DATE_TRUNC('month', CURRENT_DATE)::DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment usage (called by the app)
CREATE OR REPLACE FUNCTION increment_usage(p_mode TEXT)
RETURNS JSON AS $$
DECLARE
    profile profiles%ROWTYPE;
    result JSON;
BEGIN
    -- Reset if needed
    PERFORM reset_daily_usage();
    PERFORM reset_monthly_usage();

    -- Get current profile
    SELECT * INTO profile FROM profiles WHERE id = auth.uid();
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Profile not found');
    END IF;

    -- Pro users: no limits
    IF profile.plan = 'pro' THEN
        UPDATE profiles SET
            daily_ai_used = CASE WHEN p_mode = 'ai' THEN daily_ai_used + 1 ELSE daily_ai_used END,
            daily_grammar_used = CASE WHEN p_mode = 'grammar' THEN daily_grammar_used + 1 ELSE daily_grammar_used END,
            monthly_used = monthly_used + 1,
            updated_at = NOW()
        WHERE id = auth.uid();

        INSERT INTO usage_logs (user_id, mode) VALUES (auth.uid(), p_mode);

        RETURN json_build_object('allowed', true, 'plan', 'pro');
    END IF;

    -- Free users: check limits
    IF p_mode = 'ai' AND profile.daily_ai_used >= 10 THEN
        RETURN json_build_object('allowed', false, 'reason', 'Daily AI limit reached (10/day)', 'plan', 'free');
    END IF;
    IF p_mode = 'grammar' AND profile.daily_grammar_used >= 15 THEN
        RETURN json_build_object('allowed', false, 'reason', 'Daily grammar limit reached (15/day)', 'plan', 'free');
    END IF;
    IF profile.monthly_used >= 200 THEN
        RETURN json_build_object('allowed', false, 'reason', 'Monthly limit reached (200/month)', 'plan', 'free');
    END IF;

    -- Allowed: increment
    UPDATE profiles SET
        daily_ai_used = CASE WHEN p_mode = 'ai' THEN daily_ai_used + 1 ELSE daily_ai_used END,
        daily_grammar_used = CASE WHEN p_mode = 'grammar' THEN daily_grammar_used + 1 ELSE daily_grammar_used END,
        monthly_used = monthly_used + 1,
        updated_at = NOW()
    WHERE id = auth.uid();

    INSERT INTO usage_logs (user_id, mode) VALUES (auth.uid(), p_mode);

    RETURN json_build_object(
        'allowed', true,
        'plan', 'free',
        'daily_ai', profile.daily_ai_used + (CASE WHEN p_mode = 'ai' THEN 1 ELSE 0 END),
        'daily_grammar', profile.daily_grammar_used + (CASE WHEN p_mode = 'grammar' THEN 1 ELSE 0 END),
        'monthly', profile.monthly_used + 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get usage summary
CREATE OR REPLACE FUNCTION get_usage_summary()
RETURNS JSON AS $$
DECLARE
    profile profiles%ROWTYPE;
BEGIN
    PERFORM reset_daily_usage();
    PERFORM reset_monthly_usage();

    SELECT * INTO profile FROM profiles WHERE id = auth.uid();
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Not found');
    END IF;

    RETURN json_build_object(
        'dailyAI', profile.daily_ai_used,
        'dailyGrammar', profile.daily_grammar_used,
        'monthlyTotal', profile.monthly_used,
        'plan', profile.plan,
        'limitReached', (
            (profile.plan = 'free') AND (
                profile.daily_ai_used >= 10 OR
                profile.daily_grammar_used >= 15 OR
                profile.monthly_used >= 200
            )
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
