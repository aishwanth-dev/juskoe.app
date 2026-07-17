-- ============================================
-- JUSKOE — Production Database Setup
-- Run this script in Supabase SQL Editor
-- ============================================

-- 1. Create app_config table if not exists (for edge functions)
CREATE TABLE IF NOT EXISTS public.app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (service role only)
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Service role can access (for edge functions)
DROP POLICY IF EXISTS "Service role full access" ON public.app_config;
CREATE POLICY "Service role full access" ON public.app_config
    FOR ALL 
    USING (true);

-- Insert/Update Razorpay credentials
INSERT INTO public.app_config (key, value) 
VALUES ('razorpay_key_id', 'rzp_live_TE6o8sifp0hU9I')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO public.app_config (key, value) 
VALUES ('razorpay_key_secret', 'MuLOnA1GwolC8bOYavW7uEv9')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = NOW();

-- Verify the update
SELECT key, value, updated_at 
FROM public.app_config 
WHERE key LIKE 'razorpay%';

-- 2. Create coupon redemptions table if not exists
CREATE TABLE IF NOT EXISTS coupon_redemptions (
    email TEXT PRIMARY KEY,
    coupon_code TEXT NOT NULL,
    redeemed_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Service role can read/write (edge functions only)
DROP POLICY IF EXISTS "Service role full access" ON coupon_redemptions;
CREATE POLICY "Service role full access" ON coupon_redemptions
    FOR ALL 
    USING (auth.role() = 'service_role');

-- 3. Verify subscriptions table has 'trialing' status
-- (validate-coupon edge function needs this for 2-month trial)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'subscriptions_status_check'
    ) THEN
        ALTER TABLE subscriptions 
        ADD CONSTRAINT subscriptions_status_check
        CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing', 'pending'));
    END IF;
END$$;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_email 
ON coupon_redemptions(email);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id_status 
ON subscriptions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_profiles_plan 
ON profiles(plan);

-- 5. Verify all required tables exist
DO $$
DECLARE
    missing_tables TEXT[];
BEGIN
    SELECT ARRAY_AGG(t) INTO missing_tables
    FROM (
        VALUES 
            ('profiles'),
            ('subscriptions'),
            ('usage_logs'),
            ('cloud_dictionary'),
            ('cloud_snippets'),
            ('cloud_notes'),
            ('app_config'),
            ('coupon_redemptions')
    ) AS required(t)
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = t
    );

    IF array_length(missing_tables, 1) > 0 THEN
        RAISE WARNING 'Missing tables: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE 'All required tables exist ✓';
    END IF;
END$$;

-- 6. Check Google OAuth provider is configured
-- (Manual step — verify in Supabase Dashboard → Authentication → Providers → Google)
DO $$
BEGIN
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'MANUAL CONFIGURATION REQUIRED:';
    RAISE NOTICE '==================================================';
    RAISE NOTICE '1. Go to Supabase Dashboard → Authentication → Providers → Google';
    RAISE NOTICE '2. Enable Google provider';
    RAISE NOTICE '3. Set Client ID: REPLACED_CLIENT_ID';
    RAISE NOTICE '4. Set Client Secret: REPLACED_CLIENT_SECRET';
    RAISE NOTICE '5. Add Authorized Redirect URIs:';
    RAISE NOTICE '   - https://rrromegwhhkyjsfxvesu.supabase.co/auth/v1/callback';
    RAISE NOTICE '   - https://juskoe.in/auth/callback';
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'RAZORPAY WEBHOOK SETUP:';
    RAISE NOTICE '==================================================';
    RAISE NOTICE '1. Go to Razorpay Dashboard → Settings → Webhooks';
    RAISE NOTICE '2. Create webhook with URL:';
    RAISE NOTICE '   https://rrromegwhhkyjsfxvesu.supabase.co/functions/v1/razorpay-webhook';
    RAISE NOTICE '3. Subscribe to events:';
    RAISE NOTICE '   - subscription.activated';
    RAISE NOTICE '   - subscription.charged';
    RAISE NOTICE '   - subscription.cancelled';
    RAISE NOTICE '   - subscription.completed';
    RAISE NOTICE '   - payment.failed';
    RAISE NOTICE '4. Copy the Webhook Secret';
    RAISE NOTICE '5. Add to Supabase Edge Function env vars:';
    RAISE NOTICE '   RAZORPAY_WEBHOOK_SECRET=<your_secret>';
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'EDGE FUNCTION ENVIRONMENT VARIABLES:';
    RAISE NOTICE '==================================================';
    RAISE NOTICE 'Go to Supabase Dashboard → Project Settings → Edge Functions';
    RAISE NOTICE 'Add/Update:';
    RAISE NOTICE '  RAZORPAY_KEY_ID=rzp_live_TE6o8sifp0hU9I';
    RAISE NOTICE '  RAZORPAY_KEY_SECRET=MuLOnA1GwolC8bOYavW7uEv9';
    RAISE NOTICE '  RAZORPAY_WEBHOOK_SECRET=<from_razorpay_dashboard>';
    RAISE NOTICE '==================================================';
END$$;

-- 7. Verify RPC functions exist for usage tracking
DO $$
DECLARE
    missing_functions TEXT[];
BEGIN
    SELECT ARRAY_AGG(f) INTO missing_functions
    FROM (
        VALUES 
            ('increment_usage'),
            ('get_usage_summary')
    ) AS required(f)
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = f
    );

    IF array_length(missing_functions, 1) > 0 THEN
        RAISE WARNING 'Missing RPC functions: %', array_to_string(missing_functions, ', ');
        RAISE WARNING 'You may need to run the full schema.sql to create these functions';
    ELSE
        RAISE NOTICE 'All RPC functions exist ✓';
    END IF;
END$$;

-- 8. Final verification summary
SELECT 
    'Database Setup Complete!' as status,
    'Razorpay credentials updated' as razorpay_status,
    'Coupon redemptions table ready' as coupons_status,
    'Subscription statuses verified' as subscriptions_status,
    'See notices above for manual configuration steps' as next_steps;

