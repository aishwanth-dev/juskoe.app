/**
 * JUSKOE — Edge Function Test Script
 * Tests the ai-proxy edge function with a real auth token
 *
 * Usage:
 *   npx ts-node scripts/test-edge-function.ts
 *
 * Prerequisites:
 *   - User must be logged in (session token available)
 *   - KJUS secret must be set in Supabase Edge Function secrets
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rrromegwhhkyjsfxvesu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJycm9tZWd3aGhreWpzZnh2ZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMjM1NDIsImV4cCI6MjA4Njc5OTU0Mn0.m0bJCOLoBFCMnFFhb2SaKoYandShMLxJ90etIDewErE';

async function testAIProxy() {
    console.log('=== JUSKOE Edge Function Test ===\n');

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Step 1: Get current session
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        console.error('❌ No active session. Please log in first.');
        console.log('\nTo test manually, you can sign in first:');
        console.log('  1. Run the app and sign in');
        console.log('  2. Or use: supabase.auth.signInWithPassword({ email, password })');
        return;
    }

    console.log(`✅ Session found for: ${session.user.email}`);
    console.log(`   User ID: ${session.user.id}`);
    console.log(`   Token expires: ${new Date(session.expires_at! * 1000).toISOString()}\n`);

    // Step 2: Test ai-proxy edge function
    console.log('--- Testing ai-proxy Edge Function ---');
    const aiProxyUrl = `${SUPABASE_URL}/functions/v1/ai-proxy`;

    try {
        const response = await fetch(aiProxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
                systemPrompt: 'You are a helpful test assistant. Respond in exactly 5 words.',
                userPrompt: 'Say hello to Juskoe',
                mode: 'ai',
            }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log(`✅ AI Proxy works! (${data.latencyMs}ms)`);
            console.log(`   Output: "${data.output}"`);
        } else {
            console.error(`❌ AI Proxy error: ${data.error}`);
            console.error(`   Status: ${response.status}`);
            if (data.error?.includes('not configured')) {
                console.error('   → The KJUS secret is not set. Set it in Supabase Dashboard → Edge Functions → Secrets');
            }
        }
    } catch (err: any) {
        console.error(`❌ Network error: ${err.message}`);
    }

    // Step 3: Test profile fetch
    console.log('\n--- Testing Profile Fetch ---');
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (error) {
            console.error(`❌ Profile fetch error: ${error.message}`);
            if (error.message.includes('does not exist') || error.code === '42P01') {
                console.error('   → The "profiles" table does not exist. Run schema.sql in Supabase SQL Editor.');
            }
        } else {
            console.log(`✅ Profile found:`);
            console.log(`   Name: ${profile.full_name}`);
            console.log(`   Email: ${profile.email}`);
            console.log(`   Plan: ${profile.plan}`);
            console.log(`   AI Used Today: ${profile.daily_ai_used}`);
            console.log(`   Grammar Used Today: ${profile.daily_grammar_used}`);
            console.log(`   Monthly Used: ${profile.monthly_used}`);
        }
    } catch (err: any) {
        console.error(`❌ Profile error: ${err.message}`);
    }

    // Step 4: Test get_usage_summary RPC
    console.log('\n--- Testing get_usage_summary RPC ---');
    try {
        const { data, error } = await supabase.rpc('get_usage_summary');
        if (error) {
            console.error(`❌ RPC error: ${error.message}`);
            if (error.message.includes('does not exist')) {
                console.error('   → The get_usage_summary function does not exist. Run schema.sql in Supabase SQL Editor.');
            }
        } else {
            console.log(`✅ Usage summary:`);
            console.log(`   Daily AI: ${data.daily_ai}`);
            console.log(`   Daily Grammar: ${data.daily_grammar}`);
            console.log(`   Monthly Total: ${data.monthly_total}`);
            console.log(`   Limit Reached: ${data.limit_reached}`);
        }
    } catch (err: any) {
        console.error(`❌ RPC error: ${err.message}`);
    }

    // Step 5: Test RLS — attempt to read another user's data
    console.log('\n--- Testing RLS Security ---');
    try {
        const { data: allProfiles, error } = await supabase
            .from('profiles')
            .select('id, email, full_name');

        if (error) {
            console.log(`✅ RLS working: ${error.message}`);
        } else if (allProfiles && allProfiles.length <= 1) {
            console.log(`✅ RLS working: Can only see ${allProfiles.length} profile(s) (own data only)`);
        } else {
            console.error(`⚠️ RLS concern: Can see ${allProfiles?.length} profiles — should be 1`);
        }
    } catch (err: any) {
        console.error(`❌ RLS test error: ${err.message}`);
    }

    console.log('\n=== Test Complete ===');
}

testAIProxy().catch(console.error);
