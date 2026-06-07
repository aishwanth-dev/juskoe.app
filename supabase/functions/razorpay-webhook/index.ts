// ============================================
// Supabase Edge Function: razorpay-webhook
// Handles Razorpay payment events (subscription activated/cancelled)
// Updates user profile plan to 'pro' or 'free'
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAZORPAY_WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!;

// HMAC SHA256 using Web Crypto API (built-in, no external deps)
async function verifySignature(body: string, signature: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(RAZORPAY_WEBHOOK_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const hashArray = Array.from(new Uint8Array(sig));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === signature;
}

serve(async (req) => {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        // ---- 1. Verify Razorpay signature ----
        const body = await req.text();
        const razorpaySignature = req.headers.get('x-razorpay-signature');

        if (!razorpaySignature) {
            console.error('[webhook] Missing Razorpay signature');
            return new Response('Missing signature', { status: 400 });
        }

        if (RAZORPAY_WEBHOOK_SECRET) {
            const valid = await verifySignature(body, razorpaySignature);
            if (!valid) {
                console.error('[webhook] Invalid signature');
                return new Response('Invalid signature', { status: 401 });
            }
        }

        // ---- 2. Parse webhook event ----
        const event = JSON.parse(body);
        const eventType = event.event;
        console.log(`[webhook] Event: ${eventType}`);

        // Use service role client for DB writes (no user context in webhooks)
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // ---- 3. Handle events ----
        switch (eventType) {
            case 'subscription.activated':
            case 'subscription.charged': {
                const subscription = event.payload.subscription.entity;
                const subscriptionId = subscription.id;
                const userId = subscription.notes?.user_id;

                if (!userId) {
                    console.error('[webhook] No user_id in subscription notes');
                    return new Response('OK', { status: 200 });
                }

                console.log(`[webhook] Activating Pro for user ${userId}`);

                // Update subscription status
                await supabase
                    .from('subscriptions')
                    .update({
                        status: 'active',
                        current_period_start: new Date(subscription.current_start * 1000).toISOString(),
                        current_period_end: new Date(subscription.current_end * 1000).toISOString(),
                    })
                    .eq('razorpay_subscription_id', subscriptionId);

                // Update profile to Pro
                await supabase
                    .from('profiles')
                    .update({
                        plan: 'pro',
                        subscription_status: 'active',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', userId);

                console.log(`[webhook] User ${userId} upgraded to Pro`);
                break;
            }

            case 'subscription.cancelled':
            case 'subscription.completed': {
                const subscription = event.payload.subscription.entity;
                const subscriptionId = subscription.id;
                const userId = subscription.notes?.user_id;

                if (!userId) {
                    console.error('[webhook] No user_id in subscription notes');
                    return new Response('OK', { status: 200 });
                }

                console.log(`[webhook] Cancelling Pro for user ${userId}`);

                // Update subscription status
                await supabase
                    .from('subscriptions')
                    .update({ status: 'cancelled' })
                    .eq('razorpay_subscription_id', subscriptionId);

                // Downgrade profile to free
                await supabase
                    .from('profiles')
                    .update({
                        plan: 'free',
                        subscription_status: 'cancelled',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', userId);

                console.log(`[webhook] User ${userId} downgraded to free`);
                break;
            }

            case 'payment.failed': {
                const payment = event.payload.payment.entity;
                console.error(`[webhook] Payment failed: ${payment.id} - ${payment.error_description}`);
                break;
            }

            default:
                console.log(`[webhook] Unhandled event: ${eventType}`);
        }

        return new Response('OK', { status: 200 });

    } catch (error) {
        console.error('[webhook] Error:', error);
        return new Response('OK', { status: 200 });
    }
});
