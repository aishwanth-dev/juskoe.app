// ============================================
// Supabase Edge Function: cancel-subscription
// IMMEDIATELY cancels Razorpay + downgrades to free
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
        const authHeader = req.headers.get('authorization');
        if (!authHeader) return jsonResponse(401, { success: false, error: 'Missing authorization' });

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return jsonResponse(401, { success: false, error: 'Invalid token' });

        const serviceClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        console.log(`[cancel] User ${user.id} requesting cancellation`);

        // ---- 1. Find all subscriptions ----
        const { data: subs } = await serviceClient
            .from('subscriptions')
            .select('razorpay_subscription_id, status')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10);

        console.log(`[cancel] Found ${subs?.length || 0} subscription records`);

        // ---- 2. IMMEDIATELY cancel ALL on Razorpay ----
        const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

        if (subs && subs.length > 0) {
            for (const sub of subs) {
                if (sub.status === 'cancelled') continue;

                console.log(`[cancel] Cancelling ${sub.razorpay_subscription_id} on Razorpay`);
                try {
                    const rzpResponse = await fetch(
                        `https://api.razorpay.com/v1/subscriptions/${sub.razorpay_subscription_id}/cancel`,
                        {
                            method: 'POST',
                            headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ cancel_at_cycle_end: 0 }),
                        }
                    );
                    console.log(`[cancel] Razorpay response: ${rzpResponse.status}`);
                } catch (e) {
                    console.error(`[cancel] Razorpay error:`, e);
                }

                // Mark cancelled in DB
                await serviceClient.from('subscriptions').update({ status: 'cancelled' })
                    .eq('razorpay_subscription_id', sub.razorpay_subscription_id);
            }
        }

        // ---- 3. Downgrade profile to FREE immediately ----
        const { error: profileErr } = await serviceClient
            .from('profiles')
            .update({ plan: 'free', updated_at: new Date().toISOString() })
            .eq('id', user.id);

        if (profileErr) {
            console.error('[cancel] Profile update error:', JSON.stringify(profileErr));
            return jsonResponse(500, { success: false, error: 'Failed to update profile' });
        }

        console.log(`[cancel] User ${user.id} downgraded to free ✓`);
        return jsonResponse(200, { success: true });

    } catch (error) {
        console.error('[cancel] Error:', error);
        return jsonResponse(500, { success: false, error: String(error) });
    }
});

function jsonResponse(status, data) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}
