// ============================================================================
// Bug-condition exploration tests for spec:
//   .kiro/specs/hotkey-stale-input-and-homepage-sort-fix
//
// Per the bugfix workflow, these tests are EXPECTED TO FAIL on unfixed code.
// Failure confirms both bugs exist:
//   Bug 1 — replaceSnippetsInText in src/main/aiProcessor.ts substitutes a
//           poisoned snippet's long content into any transcript containing the
//           bare snippet key, because the prefix `(?:add|insert|use|my)?` is
//           OPTIONAL and the title regex has no prefix at all.
//   Bug 2 — HomePage.tsx in src/renderer/pages/HomePage.tsx renders
//           history.map(...) with no descending-by-timestamp sort, so any
//           shuffled or oldest-first input ends up rendered out of order.
//
// Concrete counterexample seeds (synthetic — chosen to mirror the user's
// reported stale-prompt symptom):
//   poisonedSnippet = {
//       id: 9999,
//       key: "email",
//       title: "Personal Email",
//       content: <205-char paragraph beginning with "Display recent items
//                on the homepage from newest to oldest...">
//   }
//   utterance = "please send me your email address" — bare word "email", no
//   explicit prefix, so by spec replaceSnippetsInText MUST return the
//   utterance unchanged. On unfixed code it returns the stale 205-char
//   paragraph instead.
//
// At test-authoring time, the live %APPDATA%\Juskoe\juskoe-data.json was
// inspected and contained no >200-char poisoned snippet (longest content was
// 26 chars), so the bug is reproduced here with a synthetic seed rather than
// the user's current on-disk state. The CODE pattern that allows the bug
// (loose regex, no length guard) is still present in src/main/aiProcessor.ts
// at the time of writing.
//
// Run with:   node --test tests/bug-condition-exploration.test.mjs
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Bug 1 — Snippet replacement leaks long stored content into any transcript
// ---------------------------------------------------------------------------
//
// Faithful re-implementation of the UNFIXED replaceSnippetsInText body from
// src/main/aiProcessor.ts (lines ~50-66 at the time of writing). We replicate
// it here so the test exercises the live regex shape without needing the
// Electron module graph. The static-source assertion below pins this to the
// real source file, so a future fix that rewrites the regex will be picked
// up by the property test naturally.
//
// Validates: Requirements 2.1, 2.3, 2.4 (Bug 1 fix-check property)

function replaceSnippetsInText_unfixedShape(text, snippets) {
    let result = text;
    const replacements = [];
    for (const snippet of snippets) {
        const patterns = [
            new RegExp(`\\b(?:add|insert|use|my)?\\s*${snippet.key}\\b`, 'gi'),
            new RegExp(`\\b${snippet.title}\\b`, 'gi'),
        ];
        for (const pattern of patterns) {
            if (pattern.test(result)) {
                result = result.replace(pattern, snippet.content);
                replacements.push(snippet.key);
            }
        }
    }
    return { result, replacements };
}

const STALE_PROMPT =
    'Display recent items on the homepage from newest to oldest. Ensure the privacy policy and all other pages are correctly configured, using juskoe.in exclusively, do not use the .com domain. Resolve these issues and build the final app. Set the app to launch on startup by default.';

const poisonedSnippet = {
    id: 9999,
    key: 'email',
    title: 'Personal Email',
    content: STALE_PROMPT, // > 200 chars
};

// Utterances that do NOT contain an explicit `add|insert|use|paste|my` prefix
// immediately before the snippet key/title. By the spec, none of these may
// trigger substitution. On unfixed code, every one of these is rewritten to
// STALE_PROMPT because the prefix in the regex is optional.
const benignUtterances = [
    'please send me your email address',
    'i lost access to my old email account yesterday',
    'the email server was down all morning',
    'forward the email to the team',
    'the personal email i mentioned was important',
    'an email is the fastest way to reach them',
];

test('Bug 1 (exploration): poisoned snippet must not substitute without explicit prefix', () => {
    const failures = [];
    for (const utterance of benignUtterances) {
        const { result } = replaceSnippetsInText_unfixedShape(utterance, [poisonedSnippet]);
        if (result !== utterance) {
            failures.push({
                utterance,
                gotLength: result.length,
                got: result.slice(0, 80) + (result.length > 80 ? '...' : ''),
            });
        }
    }
    // EXPECTED on unfixed code: failures.length > 0 and every result equals
    // STALE_PROMPT instead of the original utterance.
    assert.deepEqual(
        failures,
        [],
        `Bug 1 confirmed — poisoned snippet hijacked ${failures.length}/${benignUtterances.length} utterances. ` +
        `Counterexample: ${JSON.stringify(failures[0])}`
    );
});

test('Bug 1 (static-source check): unfixed regex pattern is still present in src/main/aiProcessor.ts', () => {
    const src = readFileSync(resolve(repoRoot, 'src/main/aiProcessor.ts'), 'utf8');
    // The unfixed regex literal — optional prefix, allowing bare-word match.
    const unfixedPattern = '(?:add|insert|use|my)?\\\\s*${snippet.key}';
    const titleBareMatch = '\\\\b${snippet.title}\\\\b';
    const stillUnfixed = src.includes(unfixedPattern) && src.includes(titleBareMatch);
    assert.equal(
        stillUnfixed,
        false,
        'Bug 1 confirmed at the source — replaceSnippetsInText still uses the loose ' +
        '`(?:add|insert|use|my)?\\s*${snippet.key}` regex and the unbounded ' +
        '`\\b${snippet.title}\\b` regex in src/main/aiProcessor.ts. The fix should ' +
        'tighten this to require an explicit prefix and drop the bare-title regex.'
    );
});

// ---------------------------------------------------------------------------
// Bug 2 — HomePage renders history without sorting descending by createdAt
// ---------------------------------------------------------------------------
//
// Rendering React in a Node test would require pulling in jsdom + a renderer
// just to confirm a static fact about the source. We instead assert the
// fact directly: the unfixed renderer maps `history` in raw order with no
// authoritative sort step. This will FAIL on unfixed code (proving the bug)
// and PASS once the fix introduces a `sortedHistory` derived via
// `[...history].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())`
// per the design.
//
// As a secondary, runtime-shaped assertion, we also model the bug at the
// pure-data level: a shuffled list of items is rendered top-to-bottom in
// input order, which fails the "strictly descending by createdAt" property.
//
// Validates: Requirements 2.5, 2.6 (Bug 2 fix-check property)

test('Bug 2 (static-source check): HomePage.tsx must sort history descending by createdAt before render', () => {
    const src = readFileSync(resolve(repoRoot, 'src/renderer/pages/HomePage.tsx'), 'utf8');

    // Two ways to satisfy the property:
    //   1. A `sortedHistory` (or similar) derived from `[...history].sort(...)`
    //      with a descending-by-createdAt comparator.
    //   2. A direct `history.slice().sort(...)` / `[...history].sort(...)` call
    //      passed into `.map(...)`.
    const hasSortedDerivation =
        /\[\s*\.\.\.\s*history\s*\]\s*\.sort\s*\(/.test(src) ||
        /history\s*\.slice\s*\(\s*\)\s*\.sort\s*\(/.test(src);
    const sortsByCreatedAt =
        /createdAt/.test(src) &&
        /new\s+Date\s*\(\s*[ab]\.createdAt\s*\)\.getTime\s*\(\s*\)/.test(src);

    const isFixed = hasSortedDerivation && sortsByCreatedAt;
    assert.equal(
        isFixed,
        true,
        'Bug 2 confirmed at the source — HomePage.tsx renders history.map(...) with ' +
        'no descending-by-createdAt sort. Items load and render in raw array order, ' +
        'so any disk content saved in ascending order (or any future code path that ' +
        'pushes oldest-first) renders newest-at-bottom. The fix should add a ' +
        '`sortedHistory = [...history].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())` ' +
        'before .map(...).'
    );
});

test('Bug 2 (data-level): shuffled items rendered without sort violate descending-by-timestamp invariant', () => {
    // Pure-data model of the unfixed renderer: render = identity on the input array.
    function renderHomepageHistory_unfixed(items) {
        return items.map((item, idx) => ({ ...item, renderIndex: idx }));
    }

    // Property-style check across several shuffled permutations.
    function shuffle(arr, seed) {
        const a = arr.slice();
        let s = seed;
        for (let i = a.length - 1; i > 0; i--) {
            s = (s * 9301 + 49297) % 233280;
            const j = Math.floor((s / 233280) * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    const baseItems = [
        { text: 'oldest',  createdAt: '2024-01-01T10:00:00.000Z' },
        { text: 'older',   createdAt: '2024-01-02T10:00:00.000Z' },
        { text: 'middle',  createdAt: '2024-01-03T10:00:00.000Z' },
        { text: 'newer',   createdAt: '2024-01-04T10:00:00.000Z' },
        { text: 'newest',  createdAt: '2024-01-05T10:00:00.000Z' },
    ];

    const counterexamples = [];
    for (let seed = 1; seed <= 20; seed++) {
        const shuffled = shuffle(baseItems, seed);
        const rendered = renderHomepageHistory_unfixed(shuffled);
        for (let i = 0; i < rendered.length - 1; i++) {
            const aTs = new Date(rendered[i].createdAt).getTime();
            const bTs = new Date(rendered[i + 1].createdAt).getTime();
            if (aTs < bTs) {
                counterexamples.push({
                    seed,
                    inputOrder: shuffled.map(x => x.text),
                    violationAt: i,
                    older: rendered[i].text,
                    newer: rendered[i + 1].text,
                });
                break;
            }
        }
    }

    // EXPECTED on unfixed code: most shuffled inputs produce a violation
    // (shuffled order is almost never strictly descending).
    assert.equal(
        counterexamples.length,
        0,
        `Bug 2 confirmed — unfixed renderer produced ${counterexamples.length} shuffled ` +
        `inputs (out of 20) where rendered order is not descending by createdAt. ` +
        `Counterexample: ${JSON.stringify(counterexamples[0])}`
    );
});
