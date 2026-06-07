// ============================================
// Supabase Edge Function: reactivate-subscription
// Resume a paused/cancelled subscription
// ============================================

// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

        // Find cancelled subscription with remaining time
        const { data: subs } = await serviceClient
            .from('subscriptions')
            .select('razorpay_subscription_id, current_period_end, status')
            .eq('user_id', user.id)
            .eq('status', 'cancelled')
            .order('created_at', { ascending: false })
            .limit(1);

        const sub = subs?.[0];
        if (!sub) {
            return jsonResponse(400, { success: false, error: 'No cancelled subscription to resume' });
        }

        // Check if period still active
        if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) {
            return jsonResponse(400, { success: false, error: 'Subscription period has ended. Please create a new subscription.' });
        }

        console.log(`[reactivate] Resuming sub ${sub.razorpay_subscription_id} for user ${user.id}`);

        // Re-activate in DB
        const { error: updateErr } = await serviceClient
            .from('subscriptions')
            .update({ status: 'active' })
            .eq('razorpay_subscription_id', sub.razorpay_subscription_id);

        if (updateErr) {
            console.error('[reactivate] Sub update error:', JSON.stringify(updateErr));
            return jsonResponse(500, { success: false, error: 'Failed to update subscription' });
        }

        // Ensure profile is pro
        await serviceClient.from('profiles').update({
            plan: 'pro',
            updated_at: new Date().toISOString(),
        }).eq('id', user.id);

        console.log(`[reactivate] User ${user.id} subscription reactivated ✓`);

        return jsonResponse(200, { success: true });

    } catch (error) {
        console.error('[reactivate] Error:', error);
        return jsonResponse(500, { success: false, error: String(error) });
    }
});

function jsonResponse(status, data) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}
