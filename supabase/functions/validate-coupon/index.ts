// ============================================
// Supabase Edge Function: validate-coupon
// Validates hardcoded coupon codes for 1-month free trial
// - One coupon per account (any code, one-time only)
// - Max 100 redemptions per coupon code
// - Monthly plan only (not annual)
// - Cancels existing sub, creates new one with start_at = 30 days
// ============================================

// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;

// ---- Hardcoded coupon codes ----
const VALID_COUPONS = [
    'AIS0320', 'VIS4368', 'GOV6980',
];
const COUPON_EXPIRY = new Date('2026-12-31T23:59:59+05:30'); // Extended expiry
const FREE_MONTHS = 1;
const MAX_REDEMPTIONS_PER_COUPON = 100;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { code, subscription_id, email } = await req.json();
        const upperCode = (code || '').toUpperCase().trim();

        // ---- 1. Validate coupon code ----
        if (!upperCode) {
            return json(400, { success: false, error: 'Enter a coupon code' });
        }
        if (!VALID_COUPONS.includes(upperCode)) {
            return json(200, { success: false, error: 'Invalid coupon code' });
        }
        if (new Date() > COUPON_EXPIRY) {
            return json(200, { success: false, error: 'This coupon has expired' });
        }
        if (!subscription_id) {
            return json(400, { success: false, error: 'Missing subscription' });
        }
        if (!email) {
            return json(400, { success: false, error: 'Missing email' });
        }

        const userEmail = email.toLowerCase().trim();
        const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

        // ---- 2. Service client for DB operations ----
        const serviceClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // ---- 3. Check if user already used ANY coupon ----
        // Table: coupon_redemptions (email TEXT PK, coupon_code TEXT, redeemed_at TIMESTAMPTZ)
        // Must be created via SQL editor: CREATE TABLE IF NOT EXISTS coupon_redemptions (email TEXT PRIMARY KEY, coupon_code TEXT NOT NULL, redeemed_at TIMESTAMPTZ DEFAULT now());
        const { data: existing, error: checkErr } = await serviceClient
            .from('coupon_redemptions')
            .select('coupon_code')
            .eq('email', userEmail)
            .maybeSingle();

        // If table doesn't exist yet, skip the check (first-time setup)
        if (checkErr && !checkErr.message.includes('does not exist')) {
            console.warn('[validate-coupon] DB check error:', checkErr.message);
        }

        if (existing) {
            return json(200, {
                success: false,
                error: `You've already used a coupon (${existing.coupon_code}). Only one coupon per account.`
            });
        }

        // ---- 4. Check max redemptions per coupon code (100 max) ----
        const { count: usageCount, error: countErr } = await serviceClient
            .from('coupon_redemptions')
            .select('*', { count: 'exact', head: true })
            .eq('coupon_code', upperCode);

        if (countErr && !countErr.message.includes('does not exist')) {
            console.warn('[validate-coupon] Count check error:', countErr.message);
        }

        if (usageCount !== null && usageCount >= MAX_REDEMPTIONS_PER_COUPON) {
            return json(200, {
                success: false,
                error: `This coupon code has reached its maximum usage limit (${MAX_REDEMPTIONS_PER_COUPON}).`
            });
        }

        // ---- 5. Get current subscription details from Razorpay ----
        const subResponse = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscription_id}`, {
            headers: { 'Authorization': `Basic ${auth}` },
        });
        if (!subResponse.ok) {
            return json(502, { success: false, error: 'Could not verify subscription' });
        }
        const existingSub = await subResponse.json();

        // ---- 6. Only monthly plans allowed ----
        // Check plan period by fetching the plan
        if (existingSub.plan_id) {
            const planRes = await fetch(`https://api.razorpay.com/v1/plans/${existingSub.plan_id}`, {
                headers: { 'Authorization': `Basic ${auth}` },
            });
            if (planRes.ok) {
                const planData = await planRes.json();
                if (planData.period === 'yearly') {
                    return json(200, {
                        success: false,
                        error: 'Coupons are only valid for monthly plans'
                    });
                }
            }
        }

        // ---- 7. Cancel the existing subscription ----
        try {
            await fetch(`https://api.razorpay.com/v1/subscriptions/${subscription_id}/cancel`, {
                method: 'POST',
                headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ cancel_at_cycle_end: 0 }),
            });
            console.log(`[validate-coupon] Cancelled old sub: ${subscription_id}`);
        } catch (e) {
            console.warn('[validate-coupon] Could not cancel old sub:', e);
        }

        // ---- 8. Create NEW Razorpay plan (monthly ₹359) ----
        const planResponse = await fetch('https://api.razorpay.com/v1/plans', {
            method: 'POST',
            headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                period: 'monthly',
                interval: 1,
                item: {
                    name: 'Juskoe',
                    amount: 35900, // ₹359
                    currency: 'INR',
                    description: 'Juskoe Pro Monthly (1-month free trial)',
                },
            }),
        });

        if (!planResponse.ok) {
            const errText = await planResponse.text();
            console.error('[validate-coupon] Plan creation failed:', errText);
            return json(502, { success: false, error: 'Failed to create plan' });
        }
        const newPlan = await planResponse.json();

        // ---- 9. Create NEW subscription with start_at = 60 days from now ----
        const startAt = Math.floor(Date.now() / 1000) + (FREE_MONTHS * 30 * 24 * 60 * 60);
        const userId = existingSub.notes?.user_id || '';

        const newSubResponse = await fetch('https://api.razorpay.com/v1/subscriptions', {
            method: 'POST',
            headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                plan_id: newPlan.id,
                total_count: 120,
                quantity: 1,
                customer_notify: 1,
                start_at: startAt,
                notes: {
                    user_id: userId,
                    email: userEmail,
                    plan_type: 'pro_monthly',
                    coupon_code: upperCode,
                    free_trial: 'true',
                    free_months: String(FREE_MONTHS),
                    max_redemptions: String(MAX_REDEMPTIONS_PER_COUPON),
                },
            }),
        });

        if (!newSubResponse.ok) {
            const errText = await newSubResponse.text();
            console.error('[validate-coupon] New sub creation failed:', errText);
            return json(502, { success: false, error: 'Failed to create trial subscription' });
        }
        const newSub = await newSubResponse.json();

        // ---- 10. Update DB: mark old sub cancelled, create new sub record ----
        // Cancel old DB record
        await serviceClient.from('subscriptions')
            .update({ status: 'cancelled' })
            .eq('razorpay_subscription_id', subscription_id);

        // Insert new sub record with trial info
        const trialEnd = new Date(Date.now() + FREE_MONTHS * 30 * 24 * 60 * 60 * 1000);
        await serviceClient.from('subscriptions').upsert({
            user_id: userId,
            razorpay_subscription_id: newSub.id,
            plan: 'pro',
            status: 'trialing',
            current_period_start: new Date().toISOString(),
            current_period_end: trialEnd.toISOString(),
        }, { onConflict: 'user_id' });

        // Update user profile to pro
        await serviceClient.from('profiles')
            .update({ plan: 'pro' })
            .eq('id', userId);

        // ---- 11. Record coupon redemption ----
        await serviceClient.from('coupon_redemptions').insert({
            email: userEmail,
            coupon_code: upperCode,
        });

        console.log(`[validate-coupon] SUCCESS: ${userEmail} used ${upperCode}, new sub: ${newSub.id}, trial ends: ${trialEnd.toISOString()}`);

        return json(200, {
            success: true,
            offer_id: null,
            new_subscription_id: newSub.id,
            description: `1 month free! First charge of ₹359 on ${trialEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
            free_months: FREE_MONTHS,
            trial_end: trialEnd.toISOString(),
        });

    } catch (error) {
        console.error('[validate-coupon] Error:', error);
        return json(500, { success: false, error: 'Server error. Try again.' });
    }
});

function json(status: number, body: Record<string, unknown>) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}
