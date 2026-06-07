# Hotkey Stale Input and Homepage Sort Fix — Bugfix Design

## Overview

Two defects in the same Electron + React app are addressed together:

- **Bug 1 (stale AI input)** — Whatever the user says into F7 / F8 / F9, the AI returns text generated from a single old prompt that lives somewhere in local storage, not from the freshly captured STT transcript or fresh selection. Static analysis of `src/main/aiProcessor.ts`, `src/main/main.ts`, `src/renderer/App.tsx`, and `src/main/localStorage.ts` shows that the live audio path (renderer `MediaRecorder` → `audio:blob` → ffmpeg → Sherpa-ONNX) is recreated per press and cannot leak prior content. The only places where prior persisted state can override a fresh transcript before it reaches OpenRouter are the dictionary and snippet preprocessors in `processTranscriptRealtime` / `processGrammarMode`, and the clipboard-based `getSelectedText` call. Of those, snippet replacement is the only one whose pattern is broad enough to swallow an arbitrary user transcript and replace it with stored long-form content.
- **Bug 2 (homepage sort order)** — Items stored newest-first in `data.commandHistory` are still rendered with the newest at the bottom in some sessions. Static analysis shows that `HomePage` simply iterates `history.map(...)` with no sort, and that incoming items can be ordered both ways depending on which path populated them (load-from-disk vs. live `recording:result`). There is no single sort authority. We add one.

The fix for both bugs is small and local. No new dependencies, no new IPC channels, no schema changes, no AI / OpenRouter behavior changes.

## Glossary

- **Bug_Condition (C)** — The condition that triggers a bug. C1: AI input differs from the input derived purely from this press's fresh STT / selection / clipboard. C2: rendered homepage history is not in strict descending timestamp order.
- **Property (P)** — Required behavior under C. P1: AI sees only inputs derived from this press's fresh state. P2: homepage renders strictly descending by timestamp.
- **Preservation** — All non-buggy behavior (auth, OpenRouter call path, dictionary corrections on short tokens, valid snippet expansion, "save to notes", overlay states, cloud sync, history capping at 200, copy / hover / modal UI) must remain identical.
- **`processVoiceInput`** — Entry point in `src/main/aiProcessor.ts` that builds the user prompt for OpenRouter from the fresh transcript and the captured selection.
- **`processTranscriptRealtime`** — Helper in `src/main/aiProcessor.ts` that applies dictionary corrections, runs `replaceSnippetsInText`, and detects "save to notes". Called from `processAIMode`. Bug 1's leak point lives here.
- **`replaceSnippetsInText`** — In `src/main/aiProcessor.ts`. For every saved snippet, runs two loose regexes against the transcript and substitutes snippet `content` in place. Primary suspect for Bug 1.
- **`applyDictionaryCorrections`** — In `src/main/localStorage.ts`. Called from STT post-processing and grammar mode. Secondary suspect for Bug 1.
- **`getSelectedText`** — In `src/main/main.ts`. Captures fresh selection for F7 rewrite by clearing the clipboard, sending Ctrl+C, and only accepting the result if it is non-empty and different from the prior clipboard. Already mostly correct; we leave it intact and only add a guard.
- **`capturedSelectedText`** — Module-level variable in `main.ts` used to pass the selection from `startRecording` to the `audio:blob` handler.
- **`addCommandHistory` / `getCommandHistory`** — `src/main/localStorage.ts`. Storage is already newest-first via `[newEntry, ...prev].slice(0, 200)` and `data.commandHistory` ISO `created_at`. Not the bug source; the renderer is.
- **`HomePage` `history` prop** — Array `{ time: string; text: string; mode?: string }` passed from `App.tsx`. Currently has no `created_at`, so the renderer cannot sort authoritatively.

## Bug Details

### Bug 1 — Stale input replayed into AI

The bug manifests when the user presses F7 / F8 / F9 with a fresh STT transcript `T_new`, but the AI output is generated from a stale stored string `S_stale` (the user-reported example: the long "Display recent items… juskoe.in… launch on startup" prompt). This happens regardless of mode, regardless of whether anything is selected, and regardless of the actual spoken content.

The only persistent in-process pathway from local storage to the OpenRouter request body is `processTranscriptRealtime` → `applyDictionaryCorrections` and `replaceSnippetsInText`. Of these:

- `replaceSnippetsInText` runs two regexes per saved snippet:
  - `\b(?:add|insert|use|my)?\s*${snippet.key}\b` — the prefix is **optional** (`?`), so a saved snippet whose `key` is a common word (e.g. `letter`, `email`, `note`, `prompt`) matches almost any transcript and `result.replace(pattern, snippet.content)` substitutes the entire match span with the snippet's content. If `snippet.content` is the long stale prompt, every transcript becomes the stale prompt.
  - `\b${snippet.title}\b` — the title is matched alone with no prefix at all, so a snippet titled `"website"`, `"app"`, `"build"`, etc., will hijack any transcript containing that word.
- `applyDictionaryCorrections` is called against the same transcript and against the input to grammar mode. A dictionary entry whose `corrections[0]` is the long stale prompt will replace any matching dictionary `word` token with that prompt.

Either of these can produce the observed symptom. They will also persist across reinstalls because both tables are saved by `localStorage.ts` to disk (`%APPDATA%\Juskoe\juskoe-data.json`).

`getSelectedText` is not the leak point: it explicitly compares `afterClipboard !== beforeClipboard.trim()` and falls back to `''` when the clipboard did not change, so even with a stale clipboard the F7 path delivers `selectedText = ''` and AI Mode falls through to the "no selection" branch using `correctedText`. The leak still occurs there because `correctedText` came out of `processTranscriptRealtime`.

**Formal Specification:**
```
FUNCTION isBugCondition_StaleInput(E: HotkeyEvent): boolean
  INPUT: E captures sttTranscript, clipboardAtPress, selectedText for THIS press
  OUTPUT: boolean

  expected ← deriveAIInputFromFreshState(E)
            // = applyDictionaryCorrections(E.sttTranscript) only if every
            //   active dictionary correction is a short, plausible spelling
            //   correction; PLUS replaceSnippetsInText only if every active
            //   snippet has a clearly-bounded short key/content. Otherwise
            //   `expected` is just the cleaned, fresh sttTranscript itself.
  actual   ← aiInputSeenBy_processVoiceInput(E)

  RETURN actual.transcript   <> expected.transcript
      OR actual.selectedText <> expected.selectedText
END FUNCTION
```

### Examples

- F7, user says `"write me a short leave letter for tomorrow"`. AI replies with the stale `"Display recent items on the homepage…"` prompt instead of a leave letter. **Expected:** AI replies with a leave letter built from the spoken transcript.
- F8, user says `"please fix the grammar in this sentence i went to the store"`. AI replies with the stale `"Display recent items…"`. **Expected:** AI returns the cleaned sentence.
- F9, user says `"remind me to call mom at 5"`. The note saved to disk reads `"Display recent items…"`. **Expected:** the spoken note is saved.
- F7 with selection (`Ctrl+C` then F7) of a paragraph and instruction `"shorten this"`. AI replies with the stale prompt instead of a shortened version. **Expected:** AI shortens the actually-selected paragraph.

### Bug 2 — Homepage sort order reversed

`HomePage.tsx` renders `history.map(...)` in array order with no sort. `history` is populated from two sources:

1. On mount, via `ipcRenderer.invoke('history:get')` which returns `data.commandHistory` directly. Storage already prepends new items, so this list is newest-first.
2. At runtime, on every `recording:result`, `App.tsx` does `setHistory(prev => [newItem, ...prev.slice(0, 199)])`, prepending new items.

Both paths are individually newest-first. But the renderer has no sort authority, items only carry a display string (`time` like `"10:25 AM"`, with no date), and any past build (or any future code path that pushes items with `.push` or that loads items in a different order) silently flips the visible order. The user's reported state — newest at the bottom — is the result of historical disk content saved by an earlier build that pushed oldest-first, which then loads as-is at startup. Without an authoritative timestamp on each item and a single sort step, the homepage is one accidental insertion away from rendering in the wrong order again.

**Formal Specification:**
```
FUNCTION isBugCondition_SortOrder(items: List<HistoryItem>): boolean
  INPUT: items as rendered on the homepage
  OUTPUT: boolean

  rendered ← renderHomepageHistory(items)
  RETURN EXISTS i IN [0 .. LENGTH(rendered) - 2]
         WHERE rendered[i].timestamp < rendered[i + 1].timestamp
END FUNCTION
```

### Examples

- History on disk: `[t1="hello", t2="leave letter", t3="summary"]` written newest-first. Homepage renders top-to-bottom as `"hello" / "leave letter" / "summary"`. **Expected:** `"summary" / "leave letter" / "hello"`.
- After a fix: pressing F7 to add `"new command"` → it appears at the very top, above the previous newest item, every time, with no flicker.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- F7 / F8 / F9 hotkey registration, debounce, recording start/stop, overlay state transitions, failsafe timers.
- Renderer audio capture (`MediaRecorder` → webm → `audio:blob`).
- ffmpeg conversion to 16 kHz mono PCM and Sherpa-ONNX Whisper transcription.
- OpenRouter call path: `callGemini` → `httpsPost` → `_electronFetch` (primary) → `_nodeHttpsPost` (fallback), the `OPENROUTER_KEYS` array, `OPENROUTER_MODEL = "openai/gpt-oss-20b:free"`, retry / fallback-key behavior, timeouts, system prompts, max-token caps.
- Dictionary corrections and snippet expansion **for legitimate, short, well-formed entries** (e.g. fixing a misheard name, expanding a `"my email"` snippet to a real email address).
- "Save to notes" detection in F7, "voice-note" tagging, F9 notes flow.
- Cloud sync of notes, dictionary, snippets, command history for Pro users.
- All `HomePage` UI: empty-state copy, click-to-open modal, hover, copy-to-clipboard toast, action card, tutorial, the 200-item cap, stats row.
- IPC contract: `history:get`, `recording:result`, `stats:updated`, `voice:trigger`, etc., remain identical.
- Local persistence path and JSON shape in `localStorage.ts` remain backward compatible. New optional fields are tolerated by old reads.

**Scope:**

All inputs that do NOT involve a poisonous dictionary / snippet entry, and all renders that are already newest-first, must be completely unaffected. This includes:

- A user with no custom dictionary or snippets.
- A user whose dictionary entries are all short word-for-word corrections (length ≤ 60 chars) and whose snippets all have explicit short keys with reasonable content.
- A homepage list with 0 or 1 item.

## Hypothesized Root Cause

### Bug 1

1. **Snippet replacement is too aggressive.** `replaceSnippetsInText` in `src/main/aiProcessor.ts`:
   ```ts
   const patterns = [
       new RegExp(`\\b(?:add|insert|use|my)?\\s*${snippet.key}\\b`, 'gi'),
       new RegExp(`\\b${snippet.title}\\b`, 'gi'),
   ];
   ```
   The `(?:add|insert|use|my)?` is **optional**, so the regex collapses to `\b\s*${key}\b`, a near-bare word match. The second regex matches the snippet `title` alone with no prefix at all. If any saved snippet has a long, paragraph-shaped `content` (the stale prompt), and a `key` or `title` that is a common token in the user's speech, every transcript gets rewritten to that content before it ever reaches the AI. This is the most likely root cause given the symptom (every mode, every utterance, same stale output).

2. **Dictionary corrections can be arbitrarily long.** `applyDictionaryCorrections` substitutes `corrections[0]` for any token matching `word`. A dictionary row created by accident (e.g. an automated test, a user mistakenly storing a paragraph as a "correction") with a long `corrections[0]` will hijack any transcript containing the trigger word. Same symptom shape.

3. **No length sanity guard.** Neither preprocessor has a size sanity check. A single bad row in either table is sufficient to brick all three hotkey modes for the user.

4. **No diagnostic visibility.** The current logs print only the first 60–100 chars of the prompt, so we cannot tell from existing logs whether the stale string entered via dictionary, snippets, selection, or clipboard. We add one targeted log to settle that on first run after the fix.

### Bug 2

1. **Renderer has no sort authority.** `HomePage.tsx` renders in raw array order. Any bad ordering on disk (left over from earlier builds that ordered oldest-first) survives forever via `history:get`.
2. **Items lack a real timestamp in the renderer.** `time` is a localized display string (`"10:25 AM"`), not sortable across days, not robust to AM/PM parsing, not present at all on items added before the storage layer assigned `created_at`.

## Correctness Properties

Property 1: Bug Condition - Hotkey AI receives only fresh input

_For any_ hotkey press `E` where the user produces a fresh STT transcript, optional fresh clipboard selection, and the user has no malformed dictionary or snippet entries, the fixed code SHALL pass to `processVoiceInput` exactly the transcript and selection derived from `E`'s fresh state, with no substitution by stored long-form content. When malformed entries exist, the fixed code SHALL skip them (length-guarded) and SHALL log a single warning naming the offending entry, instead of silently corrupting the transcript.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Legitimate dictionary, snippet, and non-hotkey behavior

_For any_ input where the bug condition does NOT hold (well-formed short dictionary corrections, well-formed snippets with explicit prefixes, no selection or a fresh selection, F9 notes mode), the fixed function SHALL produce the same result as the original function, preserving dictionary corrections, snippet expansions with explicit `add | insert | use | my` prefix, "save to notes" detection, OpenRouter call path, overlay state transitions, and cloud sync.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

Property 3: Bug Condition - Homepage renders newest-first

_For any_ list of history items rendered on the homepage, regardless of the order the items were inserted into the array (load-from-disk on mount, live append on `recording:result`, or any mix), the fixed `HomePage` SHALL render them in strict descending order of insertion timestamp, with no item dropped or duplicated.

**Validates: Requirements 2.5, 2.6, 3.7**

Property 4: Preservation - Homepage UI and persistence unchanged

_For any_ list of items already in descending order under the fixed code, all other homepage behavior SHALL be identical to the original: empty-state copy, time / text / truncation per row, click-to-open modal, hover toolbar, copy-to-clipboard toast, the 200-item cap, persistence to disk, and Pro cloud sync of new items.

**Validates: Requirements 3.6, 3.8**

## Fix Implementation

### Changes Required

Three small, additive code changes plus one tiny renderer change. No schema migration. No IPC contract change. No new dependencies.

---

**File:** `src/main/aiProcessor.ts`

**Function:** `replaceSnippetsInText`

**Specific Changes:**

1. **Tighten the snippet match regex** so a snippet only fires when the user explicitly invokes it. Replace the two patterns with a single one that requires an explicit `add | insert | use | paste | my` prefix:
   ```ts
   const trigger = new RegExp(
     `\\b(?:add|insert|use|paste|my)\\s+${escapeRegex(snippet.key)}\\b`,
     'gi'
   );
   ```
   The unbounded `\b${snippet.title}\b` regex is removed.
2. **Escape the snippet key** for regex safety (`escapeRegex` helper, local to the file: `s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`).
3. **Length sanity guard**: skip any snippet whose `content.length > 500` or whose `key.length < 2`. Log once per skip:
   ```ts
   if (snippet.content.length > 500 || snippet.key.trim().length < 2) {
     console.warn('[Snippets] Skipping malformed entry:', snippet.id, snippet.key.substring(0, 40));
     continue;
   }
   ```
4. **One-line trace log** at the top of `processTranscriptRealtime` printing the SHA-equivalent first 80 chars of the raw transcript before any substitution, and a second log right before `return` printing the first 80 chars of `correctedText`. This lets us confirm in a single F7 press where the leak entered (or that it is gone).

---

**File:** `src/main/localStorage.ts`

**Function:** `applyDictionaryCorrections`

**Specific Changes:**

1. **Length sanity guard**: skip any dictionary entry where `corrections[0].length > 80` or `word.length < 2`. A real spelling correction is short. Log once per skip with the entry's `id` and first 40 chars of the offending value.
2. No regex change beyond what already exists; the goal is purely to stop a single poisoned row from rewriting an entire utterance.

---

**File:** `src/main/main.ts`

**Function:** `audio:blob` IPC handler (defensive log only)

**Specific Changes:**

1. Right before the `processVoiceInput(...)` call (and right before `processNotesMode(...)` for F9), add one log line printing the first 120 chars of `cleanedTranscript` and the first 60 chars of `selectedText`. This is the single source of truth for "what we are about to send to OpenRouter" and confirms Bug 1 is fixed in production. No behavior change.
2. No change to `getSelectedText`. Its before/after clipboard comparison is already correct for the preservation requirements; touching it would risk regressing the F7 rewrite flow.

---

**File:** `src/main/localStorage.ts` and `src/main/main.ts`

**Function:** Carry `created_at` through to the renderer via `history:get` and `recording:result`

**Specific Changes:**

1. `getCommandHistory` already returns `HistoryEntry` with `created_at`. No change.
2. The `recording:result` payload sent from `main.ts` already carries `text`. Add one optional field `createdAt: now.toISOString()` next to `time` in the `safeSendMain('recording:result', ...)` call so the renderer has an authoritative timestamp for live additions.

---

**File:** `src/renderer/App.tsx`

**Function:** `useEffect` that registers `history:get` and `recording:result`, and the `history` state

**Specific Changes:**

1. Widen the `history` state type from `{ time: string; text: string; mode?: string }` to `{ time: string; text: string; mode?: string; createdAt: string }`.
2. In the `history:get` `.then` callback, map each entry to include `createdAt: e.created_at ?? new Date(0).toISOString()` so legacy rows still sort but always sink to the bottom.
3. In the `recording:result` handler, set `createdAt: data.createdAt ?? new Date().toISOString()` on the new item.

No behavior change for items already correctly newest-first.

---

**File:** `src/renderer/pages/HomePage.tsx`

**Function:** Render of `history.map(...)`

**Specific Changes:**

1. Before mapping, derive a sorted view inside the render:
   ```tsx
   const sortedHistory = React.useMemo(
     () => [...history].sort(
       (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
     ),
     [history]
   );
   ```
2. Replace `history.map` and `history.length` checks with `sortedHistory.map` and `sortedHistory.length`.
3. Update the `HomePage` props type to accept the wider history shape.
4. No CSS / DOM / interaction change.

---

This is the entire change set. Total surface area: roughly 30–40 lines across five files. No build / packaging / dependency changes. Compatible with the existing packaged `Juskoe Setup 1.0.0.exe` build pipeline.

## Testing Strategy

### Validation Approach

Two-phase: first confirm the leak point on the unfixed build with targeted manual probes, then verify the fix removes the leak and preserves all other behavior.

### Exploratory Bug Condition Checking

**Goal:** Confirm or refute that snippets / dictionary are the leak source for Bug 1, and that the homepage has no authoritative sort for Bug 2, before changing code.

**Test Plan:** Run on the current unfixed build:

- Open `%APPDATA%\Juskoe\juskoe-data.json` (the file written by `localStorage.ts`) and inspect `dictionary` and `snippets` for entries whose `corrections[0]` or `content` matches the long stale prompt or exceeds 200 chars. Read-only.
- Press F7 and speak `"write a leave letter"`. Observe the AI output equals the stale prompt.
- Temporarily clear `data.snippets` and `data.dictionary` (rename the file, restart the app). Press F7 again with the same utterance.

**Test Cases:**

1. **F7 leak with poisoned snippet** — On unfixed code, with the poisonous snippet present, F7 returns the stale prompt. (Will fail on unfixed code.)
2. **F8 leak via the same snippet path** — Same input via `processGrammarMode` → `replaceSnippetsInText` returns stale prompt. (Will fail on unfixed code.)
3. **F9 leak via dictionary** — F9 calls `applyDictionaryCorrections(transcript)` directly and bypasses `replaceSnippetsInText`. If F9 ALSO returns the stale prompt, dictionary is the leak. If F9 is fine but F7/F8 are broken, snippets are the leak. Either narrows the root cause exactly.
4. **Homepage order on first launch with seeded oldest-first list** — Manually edit `data.commandHistory` to be in ascending order. Restart. Observe homepage renders oldest-at-top. (Will fail on unfixed code.)

**Expected Counterexamples:**

- F7 / F8 outputs = the long stale prompt regardless of utterance. Confirmed by inspecting the offending row in `juskoe-data.json`.
- Possible causes: snippet `content` ≥ 200 chars with a common `key` or `title`; dictionary `corrections[0]` ≥ 80 chars; both.

### Fix Checking

**Goal:** Verify that for every hotkey press where a fresh transcript / selection exists, the AI receives exactly that fresh input and not stored long-form content.

**Pseudocode:**
```
FOR ALL E: HotkeyEvent DO
  expected ← deriveAIInputFromFreshState(E)   // length-guarded preprocess
  actual   ← aiInputSeenBy_processVoiceInput'(E)
  ASSERT actual.transcript   = expected.transcript
  ASSERT actual.selectedText = expected.selectedText
END FOR

FOR ALL items: List<HistoryItem> DO
  rendered ← renderHomepageHistory'(items)
  FOR i FROM 0 TO LENGTH(rendered) - 2 DO
    ASSERT rendered[i].createdAt >= rendered[i + 1].createdAt
  END FOR
  ASSERT MULTISET(rendered) = MULTISET(items)
END FOR
```

### Preservation Checking

**Goal:** Verify that for inputs where the bug condition does not hold, the fixed function produces the same observable result as the original function.

**Pseudocode:**
```
FOR ALL E WHERE NOT isBugCondition_StaleInput(E) DO
  ASSERT F(E)  = F'(E)         // same OpenRouter request body, same paste text
END FOR

FOR ALL items WHERE NOT isBugCondition_SortOrder(items) DO
  ASSERT F(items) = F'(items)  // same DOM under React, same interactions
END FOR
```

**Testing Approach:** Property-based testing is appropriate for the renderer sort (random permutations of items, with stable IDs and timestamps). For preprocessors, a few targeted unit tests are enough because the input space is structured (well-formed snippet vs malformed snippet, well-formed dictionary entry vs malformed entry).

**Test Plan:**

- Snapshot the OpenRouter request body for a simple utterance on the unfixed code with an empty dictionary and empty snippets table; rerun on the fixed code and assert the bodies are byte-identical.
- Render the homepage with 0, 1, 5, and 50 items, each scenario containing items inserted in random order — assert the rendered DOM is descending by `createdAt` and contains every item exactly once.

**Test Cases:**

1. **Snippet preservation** — A snippet with `key="my email"`, `title="Personal Email"`, `content="aishwanth@juskoe.in"`. Utterance `"insert my email at the top"` still expands correctly. Utterance `"i had a personal email yesterday"` does NOT trigger expansion under the fixed regex. (Verifies the explicit-prefix tightening preserves intended behavior and removes accidental matches.)
2. **Dictionary preservation** — A dictionary entry `word="juscoe"`, `corrections=["juskoe"]`. Utterance containing `"juscoe"` is corrected to `"juskoe"`. (Verifies short corrections still apply.)
3. **F9 notes preservation** — Utterance `"remind me to call mom"`. Saved note text equals the AI-cleaned version of that utterance, not the stale prompt.
4. **Selection preservation** — F7 with a 200-character selection and instruction `"shorten this"`. AI receives the actual selected text plus the instruction, not the stale prompt.
5. **Homepage with single item** — Always renders that single item, no crash.
6. **Homepage with legacy items missing `created_at`** — Legacy items sort to the bottom (via the `new Date(0)` fallback) but still render correctly with all interactions intact.

### Unit Tests

- `replaceSnippetsInText`: malformed snippet (long content, common title) is skipped and a warning is logged; well-formed snippet still expands on explicit prefix.
- `applyDictionaryCorrections`: long-correction entry is skipped; short-correction entry still applies.
- `HomePage` sort: given a shuffled `history` prop, renders descending by `createdAt`.

### Property-Based Tests

- Generate a list of `n` history items with random distinct `createdAt` ISO strings and shuffled order. Render `HomePage`. Assert output is sorted descending and is a permutation of the input.
- Generate a snippet table with one randomly-shaped malformed snippet (long content, single-word key) plus N well-formed snippets, plus a random utterance. Assert that the malformed snippet never substitutes content into the utterance, and that well-formed snippets only substitute when the utterance contains the explicit `add|insert|use|paste|my` prefix.

### Integration Tests

- End-to-end on a clean profile: install the app, sign in as `prouser@juskoe.in`, press F7 with utterance `"write me a short leave letter"`, and assert the pasted output matches a leave letter shape (not the stale prompt).
- End-to-end with a poisoned snippet seeded into `juskoe-data.json` before launch: press F7 — assert the AI output is a leave letter, and assert the new `[Snippets] Skipping malformed entry` warning is in `juskoe-debug.log`.
- Homepage live test: trigger three F7 commands in sequence with utterances `"first"`, `"second"`, `"third"`. Assert the visible order top-to-bottom is `"third" / "second" / "first"`. Restart the app. Assert the loaded order is identical.
