-- ============================================
-- JUSKOE — Razorpay Configuration
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- Store Razorpay API keys in app_config (service_role only - not accessible by users)
INSERT INTO app_config (key, value) VALUES ('razorpay_key_id', 'rzp_live_RuIlq4fv5AecEA')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO app_config (key, value) VALUES ('razorpay_key_secret', 'KVSqHZooXrHN5ZzASI6I6HgH')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Razorpay Plan IDs (created via API)
INSERT INTO app_config (key, value) VALUES ('razorpay_plan_monthly', 'plan_SRRVOSKZnENVbT')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO app_config (key, value) VALUES ('razorpay_plan_annual', 'plan_SRRWQpEKq7LLAy')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Allow 'pending' status in subscriptions table
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing', 'pending'));
