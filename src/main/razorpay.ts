// ============================================
// JUSKOE — Razorpay Payment Integration
// Calls Supabase Edge Functions for payment flow
// ============================================

import { shell } from 'electron';
import { SUPABASE_URL } from '../shared/config';
import { getSession } from '../shared/supabase';

/**
 * Razorpay integration for JUSKOE Pro subscriptions.
 *
 * Flow:
 * 1. User clicks "Upgrade to Pro" in Settings
 * 2. Frontend calls createSubscription() via IPC
 * 3. Main process calls create-subscription Edge Function
 * 4. Edge Function creates Razorpay subscription, returns payment URL
 * 5. Payment URL opens in user's default browser
 * 6. User completes payment on Razorpay checkout page
 * 7. Razorpay webhook fires → razorpay-webhook Edge Function
 * 8. Edge Function updates profile plan → 'pro'
 * 9. Auth state refreshes in app automatically
 */

// Plan pricing reference (used for UI display only)
export const PLAN_PRICING = {
    pro_monthly: {
        amount: 359,     // ₹359/mo
        currency: 'INR',
        period: 'monthly',
        label: 'Pro Monthly',
    },
    pro_annual: {
        amount: 3600,    // ₹3,600/yr (₹300/mo × 12)
        currency: 'INR',
        period: 'yearly',
        label: 'Pro Annual',
    },
};

/**
 * Create a Razorpay subscription for the user.
 * Calls the create-subscription Edge Function which holds the Razorpay secret.
 * Opens the payment page in the user's default browser.
 */
export async function createSubscription(
    userId: string,
    planType: 'pro_monthly' | 'pro_annual',
    email: string
): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
        console.log(`[Razorpay] Creating ${planType} subscription for ${email}`);

        // Get current auth session for the Edge Function call
        const session = await getSession();
        if (!session) {
            return { success: false, error: 'Not authenticated. Please sign in first.' };
        }

        // Call Edge Function
        const response = await fetch(`${SUPABASE_URL}/functions/v1/create-subscription`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ planType }),
        });

        const data = await response.json() as any;

        if (!data.success || !data.subscriptionId) {
            console.error('[Razorpay] Subscription creation failed:', data.error);
            return { success: false, error: data.error || 'Failed to create subscription' };
        }

        // Open custom checkout page on juskoe.in (shows "Juskoe" as business name)
        const checkoutUrl = `https://juskoe.in/checkout/?subscription_id=${data.subscriptionId}&key_id=${data.keyId}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(email.split('@')[0])}&plan=${planType}`;
        console.log(`[Razorpay] Opening custom checkout: ${checkoutUrl}`);
        shell.openExternal(checkoutUrl);

        return {
            success: true,
            url: checkoutUrl,
        };

    } catch (error: any) {
        console.error('[Razorpay] Error:', error.message);
        return {
            success: false,
            error: error.message || 'Something went wrong. Please try again.',
        };
    }
}

/**
 * Cancel a subscription.
 * TODO: Implement via Edge Function when needed
 */
export async function cancelSubscription(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getSession();
        if (!session) return { success: false, error: 'Not authenticated' };

        console.log('[Razorpay] Cancelling subscription for user:', userId);

        const response = await fetch(`${SUPABASE_URL}/functions/v1/cancel-subscription`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
        });

        console.log('[Razorpay] Cancel response status:', response.status);

        let data: any;
        try {
            data = await response.json();
        } catch {
            const text = await response.text().catch(() => 'No response body');
            console.error('[Razorpay] Cancel: non-JSON response:', response.status, text);
            return { success: false, error: `Server error (${response.status})` };
        }

        console.log('[Razorpay] Cancel response:', JSON.stringify(data));

        if (data.success) {
            return { success: true };
        } else {
            return { success: false, error: data.error || `Cancel failed (${response.status})` };
        }

    } catch (error: any) {
        console.error('[Razorpay] Cancel network error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Reactivate a cancelled subscription (still has remaining days).
 * No new payment needed — just re-enables the existing subscription.
 */
export async function reactivateSubscription(): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getSession();
        if (!session) return { success: false, error: 'Not authenticated' };

        console.log('[Razorpay] Reactivating subscription...');

        const response = await fetch(`${SUPABASE_URL}/functions/v1/reactivate-subscription`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
        });

        const data = await response.json() as any;
        if (data.success) {
            console.log('[Razorpay] Subscription reactivated!');
        } else {
            console.error('[Razorpay] Reactivation failed:', data.error);
        }
        return data;

    } catch (error: any) {
        console.error('[Razorpay] Reactivate error:', error.message);
        return { success: false, error: error.message };
    }
}
