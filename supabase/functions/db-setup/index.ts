// One-shot setup function — runs razorpay config SQL using service role
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (_req) => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const results: string[] = [];

    // Insert Razorpay config into app_config
    const inserts = [
        ['razorpay_key_id', 'rzp_live_RuIlq4fv5AecEA'],
        ['razorpay_key_secret', 'KVSqHZooXrHN5ZzASI6I6HgH'],
        ['razorpay_plan_monthly', 'plan_SRRVOSKZnENVbT'],
        ['razorpay_plan_annual', 'plan_SRRWQpEKq7LLAy'],
    ];

    for (const [key, value] of inserts) {
        const { error } = await supabase.from('app_config').upsert({ key, value }, { onConflict: 'key' });
        results.push(error ? `FAIL ${key}: ${error.message}` : `OK ${key}`);
    }

    // Update subscriptions constraint via RPC
    const { error: rpcErr } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
              ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
              CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing', 'pending'));`
    });
    results.push(rpcErr ? `WARN constraint: ${rpcErr.message}` : 'OK subscriptions constraint updated');

    // Create coupon_redemptions table
    const { error: couponErr } = await supabase.rpc('exec_sql', {
        sql: `CREATE TABLE IF NOT EXISTS coupon_redemptions (
            email TEXT PRIMARY KEY,
            coupon_code TEXT NOT NULL,
            redeemed_at TIMESTAMPTZ DEFAULT now()
        );`
    });
    results.push(couponErr ? `WARN coupon_redemptions: ${couponErr.message}` : 'OK coupon_redemptions table ready');

    // Read back all config
    const { data, error: readErr } = await supabase.from('app_config').select('key,value').order('key');
    
    return new Response(JSON.stringify({ results, config: data?.map(r => r.key), error: readErr?.message }), {
        headers: { 'Content-Type': 'application/json' }
    });
});
