# Implementation Plan

- [x] 1. Write bug condition exploration tests (BEFORE fix)
  - **Property 1: Bug Condition** - Stale Input Replayed Into AI + Reversed Homepage Sort
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms both bugs exist
  - **DO NOT attempt to fix the test or code when it fails**
  - **GOAL**: Surface concrete counterexamples that demonstrate Bug 1 and Bug 2
  - **Scoped PBT Approach** (Bug 1 is deterministic given a poisoned entry — scope to that case):
    - Seed `data.snippets` with one malformed entry: `key="email"`, `title="Personal Email"`, `content=<200+ char stale prompt>`
    - Property: for all utterances `T` where `T` does NOT contain the explicit prefixes `add|insert|use|paste|my` immediately before `email`, `replaceSnippetsInText(T, [poisonedSnippet])` MUST equal `T` (no substitution). On unfixed code, this returns the stale prompt for any `T` containing the bare word `email`.
    - Seed `data.dictionary` with one malformed entry: `word="the"`, `corrections=[<long stale prompt>]`. Property: for all utterances `T`, `applyDictionaryCorrections(T)` MUST NOT lengthen `T` by more than the longest legitimate correction (≤ 80 chars).
  - **Scoped PBT Approach** (Bug 2): generate shuffled lists of `HistoryItem` with distinct ISO `createdAt`, render `HomePage`, assert rendered DOM order is strictly descending by `createdAt` and is a permutation of input.
  - Test against Bug Condition pseudocode from design: `isBugCondition_StaleInput(E)` and `isBugCondition_SortOrder(items)`
  - Run on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (proves bugs exist)
  - Document counterexamples found (e.g. `"write a leave letter"` → stale prompt; shuffled list rendered in input order)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Write preservation property tests (BEFORE fix)
  - **Property 2: Preservation** - Legitimate Snippet/Dictionary Expansion + Existing Homepage UI
  - **IMPORTANT**: Follow observation-first methodology — run UNFIXED code first, record outputs, encode into property tests
  - Observe on unfixed code with empty `snippets`/`dictionary`:
    - F7 utterance `"write a short note"` → AI receives the cleaned transcript verbatim (snapshot the OpenRouter request body)
    - `replaceSnippetsInText("write a short note", [])` returns `"write a short note"` unchanged
  - Observe on unfixed code with well-formed snippet `key="my email"`, `content="aishwanth@juskoe.in"`:
    - `"insert my email at the top"` → `"insert aishwanth@juskoe.in at the top"`
  - Observe on unfixed code with well-formed dictionary `word="juscoe"`, `corrections=["juskoe"]`:
    - `"open juscoe app"` → `"open juskoe app"`
  - Observe on unfixed code with already-descending history list (length 0, 1, 5): rendered DOM matches input order, empty-state copy renders for length 0, 200-item cap unchanged
  - Write property tests asserting these observed behaviors hold on the fixed code
  - Run on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (baseline behavior to preserve)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 3. Fix stale input + homepage sort

  - [x] 3.1 Tighten snippet replacement and add length guards
    - File: `src/main/aiProcessor.ts`, function `replaceSnippetsInText`
    - Replace the two regexes with one that REQUIRES an explicit prefix: `\b(?:add|insert|use|paste|my)\s+${escapeRegex(snippet.key)}\b`
    - Remove the unbounded `\b${snippet.title}\b` regex
    - Add local `escapeRegex` helper
    - Skip and warn for malformed snippets: `content.length > 500` or `key.trim().length < 2`
    - Add trace log at top and bottom of `processTranscriptRealtime` (first 80 chars of raw transcript and final `correctedText`)
    - _Bug_Condition: isBugCondition_StaleInput where snippet content swallows transcript_
    - _Expected_Behavior: AI receives transcript derived purely from this press's fresh state_
    - _Preservation: well-formed snippets with explicit prefix still expand_
    - _Requirements: 2.1, 2.3, 2.4, 3.3_

  - [x] 3.2 Add dictionary length guard
    - File: `src/main/localStorage.ts`, function `applyDictionaryCorrections`
    - Skip and warn for malformed entries: `corrections[0].length > 80` or `word.length < 2`
    - Log entry id and first 40 chars of offending value
    - _Bug_Condition: isBugCondition_StaleInput where dictionary correction swallows transcript_
    - _Expected_Behavior: short corrections still apply; long ones are skipped_
    - _Preservation: legitimate short corrections unchanged_
    - _Requirements: 2.1, 2.3, 2.4, 3.3_

  - [x] 3.3 Add diagnostic log + carry createdAt in recording:result
    - File: `src/main/main.ts`
    - In `audio:blob` handler, log first 120 chars of `cleanedTranscript` and first 60 chars of `selectedText` immediately before `processVoiceInput(...)` and `processNotesMode(...)`
    - In the `safeSendMain('recording:result', ...)` payload, add `createdAt: now.toISOString()`
    - Do NOT modify `getSelectedText`
    - _Bug_Condition: isBugCondition_StaleInput + isBugCondition_SortOrder_
    - _Expected_Behavior: production confirms fresh input reaches AI; live items carry authoritative timestamp_
    - _Preservation: IPC contract, selection capture, OpenRouter path unchanged_
    - _Requirements: 2.2, 2.5, 2.6, 3.5, 3.7_

  - [x] 3.4 Widen renderer history shape with createdAt
    - File: `src/renderer/App.tsx`
    - Widen `history` state type to include `createdAt: string`
    - In `history:get` `.then` callback: map `createdAt: e.created_at ?? new Date(0).toISOString()` (legacy items sink to bottom)
    - In `recording:result` handler: `createdAt: data.createdAt ?? new Date().toISOString()`
    - _Bug_Condition: isBugCondition_SortOrder_
    - _Expected_Behavior: every history item has an authoritative timestamp_
    - _Preservation: existing item fields and 200-item cap unchanged_
    - _Requirements: 2.5, 2.6, 3.7, 3.8_

  - [x] 3.5 Sort homepage history descending by createdAt
    - File: `src/renderer/pages/HomePage.tsx`
    - Add `sortedHistory = useMemo(() => [...history].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [history])`
    - Replace `history.map`/`history.length` with `sortedHistory.map`/`sortedHistory.length`
    - Update `HomePage` props type for the wider history shape
    - No CSS / DOM / interaction changes
    - _Bug_Condition: isBugCondition_SortOrder(items)_
    - _Expected_Behavior: rendered list strictly descending by createdAt, multiset preserved_
    - _Preservation: empty-state, modal, hover, copy toast, 200-item cap unchanged_
    - _Requirements: 2.5, 2.6, 3.6, 3.7, 3.8_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Fresh Input Reaches AI + Homepage Newest-First
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (bugs fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Legitimate Snippet/Dictionary Expansion + Existing Homepage UI
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run the full unit + property-based test suite
  - Manual smoke: with a poisoned snippet seeded in `juskoe-data.json`, press F7 saying `"write a leave letter"` — assert AI returns a leave letter and `[Snippets] Skipping malformed entry` appears in `juskoe-debug.log`
  - Manual smoke: trigger F7 with utterances `"first"`, `"second"`, `"third"` — assert homepage shows `third / second / first` top-to-bottom; restart and assert order persists
  - Ensure all tests pass; ask the user if questions arise
