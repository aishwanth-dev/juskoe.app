// ============================================
// Supabase Edge Function: create-subscription
// Creates a Razorpay subscription for authenticated user
// Handles: fresh subscribe, monthly→annual upgrade (+1 bonus month)
// ============================================

// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;

const PLANS = {
    pro_monthly: { amount: 35900, period: 'monthly', interval: 1 },  // ₹359/mo
    pro_annual:  { amount: 360000, period: 'yearly',  interval: 1 },  // ₹3,600/yr (₹300/mo × 12)
};

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // ---- 1. Auth ----
        const authHeader = req.headers.get('authorization');
        if (!authHeader) return jsonResponse(401, { success: false, error: 'Missing authorization' });

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return jsonResponse(401, { success: false, error: 'Invalid token' });

        // ---- 2. Parse plan type ----
        const { planType } = await req.json();
        if (!planType || !PLANS[planType]) {
            return jsonResponse(400, { success: false, error: 'Invalid plan type' });
        }

        const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
        const serviceClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // ---- 3. Check existing subscriptions ----
        const { data: existingSubs } = await serviceClient
            .from('subscriptions')
            .select('razorpay_subscription_id, status, current_period_start, current_period_end')
            .eq('user_id', user.id)
            .in('status', ['active', 'trialing'])
            .order('created_at', { ascending: false });

        let isUpgradeFromMonthly = false;
        let bonusDays = 0;

        if (existingSubs && existingSubs.length > 0) {
            for (const sub of existingSubs) {
                // Check if current sub is monthly (period < 60 days)
                if (sub.current_period_start && sub.current_period_end) {
                    const periodMs = new Date(sub.current_period_end).getTime() - new Date(sub.current_period_start).getTime();
                    const periodDays = periodMs / (1000 * 60 * 60 * 24);
                    if (periodDays < 60 && planType === 'pro_annual') {
                        isUpgradeFromMonthly = true;
                        // Calculate remaining days of monthly as bonus
                        const remainingMs = new Date(sub.current_period_end).getTime() - Date.now();
                        bonusDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
                        console.log(`[create-sub] Monthly→Annual upgrade detected. ${bonusDays} bonus days from remaining monthly.`);
                    }
                }

                // Cancel old sub on Razorpay
                if (sub.razorpay_subscription_id) {
                    try {
                        await fetch(`https://api.razorpay.com/v1/subscriptions/${sub.razorpay_subscription_id}/cancel`, {
                            method: 'POST',
                            headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ cancel_at_cycle_end: 0 }),
                        });
                    } catch (e) {
                        console.warn('[create-sub] Failed to cancel old sub:', e);
                    }
                }
                // Mark cancelled in DB
                await serviceClient.from('subscriptions')
                    .update({ status: 'cancelled' })
                    .eq('razorpay_subscription_id', sub.razorpay_subscription_id);
            }
        }

        // ---- 4. Create Razorpay plan ----
        const planConfig = PLANS[planType];
        const planResponse = await fetch('https://api.razorpay.com/v1/plans', {
            method: 'POST',
            headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                period: planConfig.period,
                interval: planConfig.interval,
                item: {
                    name: 'Juskoe',
                    amount: planConfig.amount,
                    currency: 'INR',
                    description: `Juskoe Pro ${planType === 'pro_monthly' ? 'Monthly' : 'Annual'} Subscription`,
                },
            }),
        });

        if (!planResponse.ok) {
            const errText = await planResponse.text();
            console.error('[create-sub] Plan creation error:', errText);
            return jsonResponse(502, { success: false, error: 'Failed to create plan.' });
        }

        const plan = await planResponse.json();

        // ---- 5. Create Razorpay subscription ----
        const subscriptionBody = {
            plan_id: plan.id,
            total_count: planType === 'pro_monthly' ? 120 : 10,
            quantity: 1,
            customer_notify: 1,
            notes: {
                user_id: user.id,
                email: user.email,
                plan_type: planType,
                bonus_days: String(bonusDays),
                is_upgrade: String(isUpgradeFromMonthly),
            },
        };

        const rzpResponse = await fetch('https://api.razorpay.com/v1/subscriptions', {
            method: 'POST',
            headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(subscriptionBody),
        });

        if (!rzpResponse.ok) {
            const errText = await rzpResponse.text();
            console.error('[create-sub] Razorpay error:', errText);
            return jsonResponse(502, { success: false, error: 'Payment service error.' });
        }

        const subscription = await rzpResponse.json();

        // ---- 6. Store in DB ----
        const now = new Date();
        let periodEnd;
        if (planType === 'pro_monthly') {
            periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        } else {
            // Annual: 365 days + bonus days from monthly upgrade
            periodEnd = new Date(now.getTime() + (365 + bonusDays) * 24 * 60 * 60 * 1000);
        }

        await serviceClient.from('subscriptions').insert({
            user_id: user.id,
            plan: 'pro',
            status: 'active',
            razorpay_subscription_id: subscription.id,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
        });

        console.log(`[create-sub] Created ${planType} for ${user.id}. Bonus: ${bonusDays}d. Ends: ${periodEnd.toISOString()}`);

        return jsonResponse(200, {
            success: true,
            subscriptionId: subscription.id,
            url: subscription.short_url,
            keyId: RAZORPAY_KEY_ID,
            isUpgrade: isUpgradeFromMonthly,
            bonusDays,
        });

    } catch (error) {
        console.error('[create-sub] Error:', error);
        return jsonResponse(500, { success: false, error: 'Internal error' });
    }
});

function jsonResponse(status, data) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}
