// ============================================
// Supabase Edge Function: confirm-payment
// Verifies Razorpay payment, activates subscription
// Handles bonus days for monthly→annual upgrades
// ============================================

// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { subscriptionId, paymentId } = await req.json();
        if (!subscriptionId) {
            return jsonResponse(400, { success: false, error: 'Missing subscriptionId' });
        }

        // ---- 1. Verify with Razorpay ----
        const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
        const rzpResponse = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}`, {
            headers: { 'Authorization': `Basic ${auth}` },
        });

        if (!rzpResponse.ok) {
            return jsonResponse(502, { success: false, error: 'Could not verify subscription' });
        }

        const subscription = await rzpResponse.json();
        console.log(`[confirm] Sub ${subscriptionId} status: ${subscription.status}`);

        if (!['active', 'authenticated', 'created'].includes(subscription.status)) {
            return jsonResponse(400, { success: false, error: `Subscription not active (${subscription.status})` });
        }

        // ---- 2. Extract info from notes ----
        const userId = subscription.notes?.user_id;
        if (!userId) {
            return jsonResponse(400, { success: false, error: 'No user_id in subscription' });
        }

        const planType = subscription.notes?.plan_type || 'pro_monthly';
        const bonusDays = parseInt(subscription.notes?.bonus_days || '0', 10);

        // ---- 3. Calculate period ----
        const now = new Date();
        let periodEnd;
        if (subscription.current_end) {
            // Use Razorpay's actual period end + bonus days
            periodEnd = new Date(subscription.current_end * 1000 + bonusDays * 24 * 60 * 60 * 1000);
        } else if (planType === 'pro_annual') {
            periodEnd = new Date(now.getTime() + (365 + bonusDays) * 24 * 60 * 60 * 1000);
        } else {
            periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        }

        // ---- 4. Update DB ----
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        await supabase.from('subscriptions').update({
            status: 'active',
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
        }).eq('razorpay_subscription_id', subscriptionId);

        await supabase.from('profiles').update({
            plan: 'pro',
            updated_at: now.toISOString(),
        }).eq('id', userId);

        console.log(`[confirm] User ${userId} → Pro (${planType}). Ends: ${periodEnd.toISOString()}. Bonus: ${bonusDays}d`);

        return jsonResponse(200, { success: true, plan: 'pro', userId, planType });

    } catch (error) {
        console.error('[confirm] Error:', error);
        return jsonResponse(500, { success: false, error: 'Internal error' });
    }
});

function jsonResponse(status, data) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}
