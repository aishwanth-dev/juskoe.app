/**
 * JUSKOE — Full Database Audit, Fix, and Test
 * Uses Supabase Management API with access token
 */

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'rrromegwhhkyjsfxvesu';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || `https://${PROJECT_REF}.supabase.co`;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!ACCESS_TOKEN || !ANON_KEY) {
    console.error('Missing env vars: SUPABASE_ACCESS_TOKEN, SUPABASE_ANON_KEY');
    console.error('Copy .env.example to .env and fill in your values');
    process.exit(1);
}
const MGMT_API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function runSQL(sql) {
    const resp = await fetch(MGMT_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
        body: JSON.stringify({ query: sql }),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`SQL error (${resp.status}): ${text}`);
    }
    return await resp.json();
}

async function main() {
    const log = [];
    const p = (msg) => { log.push(msg); };

    try {
        // =============================================
        // PHASE 1: EXPLORE EVERYTHING
        // =============================================
        p('');
        p('╔══════════════════════════════════════════════╗');
        p('║   JUSKOE — FULL DATABASE AUDIT              ║');
        p('╚══════════════════════════════════════════════╝');

        // 1A. List ALL tables
        p('\n━━━ 1. ALL TABLES IN PUBLIC SCHEMA ━━━');
        const tables = await runSQL(`
            SELECT table_name, 
                   (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as col_count
            FROM information_schema.tables t 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `);
        for (const row of tables) {
            p(`  📋 ${row.table_name} (${row.col_count} columns)`);
        }

        // 1B. Columns for EACH table
        p('\n━━━ 2. TABLE COLUMNS ━━━');
        for (const tbl of tables) {
            const cols = await runSQL(`
                SELECT column_name, data_type, column_default, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = '${tbl.table_name}'
                ORDER BY ordinal_position;
            `);
            p(`\n  📋 ${tbl.table_name}:`);
            for (const c of cols) {
                p(`     ${c.column_name} (${c.data_type}) ${c.is_nullable === 'NO' ? 'NOT NULL' : ''} ${c.column_default ? '= ' + c.column_default.substring(0, 40) : ''}`);
            }
        }

        // 1C. All triggers
        p('\n━━━ 3. ALL TRIGGERS ━━━');
        const triggers = await runSQL(`
            SELECT trigger_name, event_manipulation, event_object_table, action_statement
            FROM information_schema.triggers
            WHERE trigger_schema = 'public' OR event_object_schema = 'public'
            ORDER BY trigger_name;
        `);
        if (triggers.length === 0) {
            // Check in auth schema too
            const authTriggers = await runSQL(`
                SELECT tgname as trigger_name, tgrelid::regclass as table_name
                FROM pg_trigger 
                WHERE NOT tgisinternal
                ORDER BY tgname;
            `);
            for (const t of authTriggers) {
                p(`  ⚡ ${t.trigger_name} ON ${t.table_name}`);
            }
        } else {
            for (const t of triggers) {
                p(`  ⚡ ${t.trigger_name} ON ${t.event_object_table} (${t.event_manipulation})`);
            }
        }

        // 1D. Trigger function source code
        p('\n━━━ 4. HANDLE_NEW_USER TRIGGER SOURCE ━━━');
        const trigSrc = await runSQL(`
            SELECT proname, prosrc FROM pg_proc WHERE proname = 'handle_new_user';
        `);
        if (trigSrc.length > 0) {
            p(`  Function: ${trigSrc[0].proname}`);
            p(`  Source:\n${trigSrc[0].prosrc}`);
        } else {
            p('  ❌ handle_new_user function NOT FOUND');
        }

        // 1E. All RPC functions
        p('\n━━━ 5. ALL CUSTOM FUNCTIONS ━━━');
        const funcs = await runSQL(`
            SELECT p.proname, pg_get_function_arguments(p.oid) as args, pg_get_function_result(p.oid) as returns
            FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
            ORDER BY p.proname;
        `);
        for (const f of funcs) {
            p(`  🔧 ${f.proname}(${f.args}) → ${f.returns}`);
        }

        // 1F. RLS policies
        p('\n━━━ 6. ALL RLS POLICIES ━━━');
        const rls = await runSQL(`
            SELECT tablename, policyname, permissive, cmd, qual, with_check
            FROM pg_policies
            WHERE schemaname = 'public'
            ORDER BY tablename, policyname;
        `);
        let lastTable = '';
        for (const r of rls) {
            if (r.tablename !== lastTable) {
                p(`\n  📋 ${r.tablename}:`);
                lastTable = r.tablename;
            }
            p(`     ${r.permissive} ${r.cmd}: ${r.policyname}`);
            if (r.qual) p(`       USING: ${r.qual}`);
            if (r.with_check) p(`       CHECK: ${r.with_check}`);
        }

        // 1G. Check RLS enabled status
        p('\n━━━ 7. RLS ENABLED STATUS ━━━');
        const rlsStatus = await runSQL(`
            SELECT relname, relrowsecurity
            FROM pg_class
            WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
            AND relkind = 'r'
            ORDER BY relname;
        `);
        for (const r of rlsStatus) {
            p(`  ${r.relrowsecurity ? '🔒' : '🔓'} ${r.relname}: RLS ${r.relrowsecurity ? 'ENABLED' : 'DISABLED'}`);
        }

        // 1H. Row counts
        p('\n━━━ 8. ROW COUNTS ━━━');
        for (const tbl of tables) {
            const cnt = await runSQL(`SELECT count(*) as cnt FROM public.${tbl.table_name};`);
            p(`  ${tbl.table_name}: ${cnt[0]?.cnt || 0} rows`);
        }

        // 1I. Edge function secrets
        p('\n━━━ 9. EDGE FUNCTION SECRETS ━━━');
        try {
            const secretsResp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/secrets`, {
                headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
            });
            const secrets = await secretsResp.json();
            for (const s of secrets) {
                p(`  🔑 ${s.name}: ${s.value ? '***SET***' : '(empty)'}`);
            }
        } catch (e) {
            p(`  ⚠️ Could not fetch secrets: ${e.message}`);
        }

        // 1J. Edge functions list
        p('\n━━━ 10. EDGE FUNCTIONS ━━━');
        try {
            const fnResp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/functions`, {
                headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
            });
            const fns = await fnResp.json();
            for (const fn of fns) {
                p(`  ⚡ ${fn.name} (${fn.status || 'active'}) — v${fn.version || '?'}`);
            }
        } catch (e) {
            p(`  ⚠️ Could not fetch functions: ${e.message}`);
        }

        // Auth users
        p('\n━━━ 11. AUTH USERS ━━━');
        const users = await runSQL(`SELECT id, email, raw_user_meta_data, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;`);
        for (const u of users) {
            const meta = typeof u.raw_user_meta_data === 'string' ? JSON.parse(u.raw_user_meta_data) : u.raw_user_meta_data;
            p(`  👤 ${u.email} | meta.full_name: "${meta?.full_name || 'NOT SET'}" | id: ${u.id}`);
        }

        // Check profiles for those users
        p('\n━━━ 12. PROFILES DATA ━━━');
        const profiles = await runSQL(`SELECT id, email, full_name, plan, daily_ai_used, daily_grammar_used, monthly_used FROM public.profiles ORDER BY created_at DESC LIMIT 5;`);
        if (profiles.length === 0) {
            p('  ⚠️ NO profiles found — trigger may not have saved data');
        }
        for (const pr of profiles) {
            p(`  👤 ${pr.email} | name: "${pr.full_name}" | plan: ${pr.plan} | ai: ${pr.daily_ai_used} | grammar: ${pr.daily_grammar_used}`);
        }

        // Print all exploration results
        console.log(log.join('\n'));
        log.length = 0;

    } catch (e) {
        log.push(`\n❌ FATAL ERROR: ${e.message}`);
        console.log(log.join('\n'));
    }
}

main();
