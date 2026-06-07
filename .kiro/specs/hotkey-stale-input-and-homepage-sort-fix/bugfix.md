# Bugfix Requirements Document

## Introduction

Two defects in the Juskoe Windows app (Electron + React + Supabase, OpenRouter AI) are blocking real use of every voice-to-text hotkey and breaking the homepage feed.

**Bug 1 — Stale input replayed for every hotkey press.** Regardless of what the user says into the microphone, what is currently selected on screen, or what is on the clipboard, the AI processor (F7 = AI Mode, F8 = Grammar Mode, F9 = Notes Mode, and the F7-with-selection "Rewrite" flow) receives the same old string from a previous session and returns output for that string instead. The string the user reports as being replayed is:

> "Display recent items on the homepage from newest to oldest. Ensure the privacy policy and all other pages are correctly configured, using juskoe.in exclusively—do not use the .com domain. Resolve these issues and build the final app. Set the app to launch on startup by default."

This is an old prompt from a previous session. The bug means F7/F8/F9 are effectively non-functional — the live STT transcript or live clipboard selection never reaches the model.

**Bug 2 — Homepage history is sorted oldest-first.** The home feed is supposed to show the most recent voice command at the top so the user can scan the latest first. Right now it renders oldest-first, so the most recent item ends up at the bottom of the list.

Both bugs surface to the user every time they press F7/F8/F9, so the impact is severe and they are addressed together in this spec.

## Bug Analysis

### Current Behavior (Defect)

**Bug 1 — stale text reaches the AI:**

1.1 WHEN the user presses F7 / F8 / F9 with a fresh STT recording (a new transcript `T_new`) THEN the system passes a stale string `T_old` from a previous session into `processVoiceInput` instead of `T_new`, and the AI output is generated for `T_old`.

1.2 WHEN the user presses F7 with text actively selected (intending the "rewrite" flow) so that the new clipboard content `S_new` reflects that selection THEN the system delivers a stale `S_old` (and/or stale instruction `T_old`) to the AI processor instead of `S_new` / `T_new`, so the rewrite operates on the wrong text.

1.3 WHEN the user changes what is on the clipboard between two hotkey presses THEN the second hotkey press still uses the clipboard / transcript value captured during the first press (or earlier), not the now-current value.

1.4 WHEN the user fires F7/F8/F9 repeatedly with different spoken inputs in the same session THEN every call resolves to the same single cached string, regardless of the new audio captured by sherpa-onnx Whisper STT.

**Bug 2 — homepage sort is reversed:**

1.5 WHEN the homepage `history` array contains saved AI items with timestamps `t1 < t2 < ... < tn` THEN `HomePage.tsx` renders them in ascending chronological order (oldest at index 0 / top, newest at the bottom).

1.6 WHEN a new voice command completes and is prepended to the runtime `history` state THEN that newest item does not appear at the top of the rendered list as expected, but at a position determined by ascending order.

### Expected Behavior (Correct)

**Bug 1 — fresh input must always reach the AI:**

2.1 WHEN the user presses F7 / F8 / F9 with a fresh STT recording producing transcript `T_new` THEN the system SHALL pass exactly `T_new` (after the documented dictionary / snippet preprocessing) into `processVoiceInput` and the AI output SHALL be generated from `T_new`.

2.2 WHEN the user presses F7 with text actively selected so the freshly populated clipboard contains `S_new` THEN the system SHALL deliver `S_new` as the selected-text input and `T_new` as the instruction, so the rewrite operates on the user's current selection and current voice instruction.

2.3 WHEN the user changes the clipboard or speaks a new utterance between two hotkey presses THEN the second press SHALL use the new value, never a value cached from a prior press or prior session.

2.4 WHEN the user fires F7/F8/F9 repeatedly with different spoken inputs in the same session THEN each call SHALL resolve to AI output generated from the input captured for that specific press, with no cross-press contamination.

**Bug 2 — homepage sort must be newest-first:**

2.5 WHEN the homepage `history` array contains saved AI items with timestamps `t1 < t2 < ... < tn` THEN `HomePage.tsx` SHALL render them in descending chronological order (newest at index 0 / top, oldest at the bottom).

2.6 WHEN a new voice command completes and is added to the homepage feed THEN that newest item SHALL appear at the top of the rendered list immediately.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user presses F7/F8/F9 and the STT transcript is empty or pure noise (filtered by the existing hallucination filter) THEN the system SHALL CONTINUE TO short-circuit with a "no speech detected" overlay error and SHALL NOT call the AI.

3.2 WHEN the user presses F7 with no text selected THEN the system SHALL CONTINUE TO treat the input as plain AI Mode (no rewrite), exactly as it does today, using the freshly captured transcript.

3.3 WHEN existing dictionary corrections or snippet replacements apply to the fresh transcript THEN the system SHALL CONTINUE TO apply them in the existing order before sending the result to the AI.

3.4 WHEN the user is signed in as a Pro account (e.g. `prouser@juskoe.in`) and `cloudSync` is enabled THEN cloud-sync of notes, dictionary, snippets, and command history to Supabase SHALL CONTINUE TO work unchanged.

3.5 WHEN OpenRouter returns a result via the existing `callGemini` / `httpsPost` path (Electron `net.fetch` primary, Node `https.request` fallback, model `openai/gpt-oss-20b:free`) THEN the network path, retry / fallback-key behavior, timeouts, and overlay state transitions SHALL CONTINUE TO behave exactly as they do today.

3.6 WHEN the homepage history is empty THEN the homepage SHALL CONTINUE TO show the "No commands yet. Press F7 or F8 to start." empty state.

3.7 WHEN persisted command history is loaded from `localStorage.ts` on startup via `history:get` THEN the in-memory order on the homepage SHALL be the same descending-by-time order as items added live during the session (i.e. the loaded list and live-added items SHALL share one consistent ordering rule).

3.8 WHEN history items are clicked, copied, or rendered with the existing time / text / hover / copy-toast UI THEN that interaction SHALL CONTINUE TO work exactly as today.

### Bug Conditions and Properties

**Domain types (informal):**

```pascal
TYPE HotkeyEvent = RECORD
    mode:            ('ai' | 'grammar' | 'notes')   // F7 / F8 / F9
    sttTranscript:   string                          // fresh Whisper output for THIS press
    clipboardAtPress: string                         // clipboard snapshot at THIS press
    hasSelection:    boolean                         // did Ctrl+C produce new content?
    selectedText:    string                          // fresh selection captured at THIS press
END

TYPE AIInput = RECORD
    transcript:   string
    selectedText: string
END

TYPE HistoryItem = RECORD
    timestamp: DateTime
    text:      string
END
```

**Bug 1 — Stale input bug condition:**

```pascal
FUNCTION isBugCondition_StaleInput(E: HotkeyEvent, prior: HotkeyEvent | NULL): boolean
  // Bug fires whenever the AI receives an input that is not derived from
  // THIS hotkey press's fresh STT / selection / clipboard state.
  RETURN  prior <> NULL
      AND (E.sttTranscript <> prior.sttTranscript
           OR E.clipboardAtPress <> prior.clipboardAtPress
           OR E.selectedText <> prior.selectedText)
      AND aiInputSeenBy_processVoiceInput(E) = aiInputSeenBy_processVoiceInput(prior)
END FUNCTION
```

A simpler equivalent absolute formulation:

```pascal
FUNCTION isBugCondition_StaleInput_Absolute(E: HotkeyEvent): boolean
  // Bug fires whenever the AI input is not equal to the input derived purely
  // from THIS press's fresh state.
  expected ← deriveAIInputFromFreshState(E)   // pure function of E
  actual   ← aiInputSeenBy_processVoiceInput(E)
  RETURN actual <> expected
END FUNCTION
```

**Bug 1 — Fix-check property (P_fix1):**

```pascal
// Property: For every hotkey press, the AI processor sees ONLY the input
// derived from this press's fresh STT / selection / clipboard state.
FOR ALL E: HotkeyEvent DO
  expected ← deriveAIInputFromFreshState(E)
  actual   ← aiInputSeenBy_processVoiceInput'(E)   // F' = fixed function
  ASSERT actual.transcript   = expected.transcript
  ASSERT actual.selectedText = expected.selectedText
END FOR
```

**Bug 1 — Preservation property (P_preserve1):**

```pascal
// For all NON-buggy events (no prior contamination, fresh values used today
// already match the expected derivation), the fixed function MUST behave
// identically to the original on:
//   - dictionary corrections, snippet replacements
//   - "save to notes" detection
//   - empty / hallucination filtering
//   - overlay state transitions
//   - OpenRouter call path (model, headers, timeouts, fallback keys)
FOR ALL E WHERE NOT isBugCondition_StaleInput_Absolute(E) DO
  ASSERT F(E) = F'(E)
END FOR
```

**Bug 2 — Sort order bug condition:**

```pascal
FUNCTION isBugCondition_SortOrder(items: List<HistoryItem>): boolean
  // Bug fires whenever the homepage renders items in a non-descending order
  // by timestamp (i.e. anything other than newest-first).
  rendered ← renderHomepageHistory(items)
  RETURN NOT isSortedDescendingByTimestamp(rendered)
END FUNCTION
```

**Bug 2 — Fix-check property (P_fix2):**

```pascal
// Property: Homepage always renders history in strict descending order by
// timestamp (newest first), regardless of how items entered the list
// (loaded from disk on startup, or appended live during the session).
FOR ALL items: List<HistoryItem> DO
  rendered ← renderHomepageHistory'(items)   // F' = fixed renderer
  FOR i FROM 0 TO LENGTH(rendered) - 2 DO
    ASSERT rendered[i].timestamp >= rendered[i + 1].timestamp
  END FOR
  ASSERT MULTISET(rendered) = MULTISET(items)   // no items added or dropped
END FOR
```

**Bug 2 — Preservation property (P_preserve2):**

```pascal
// For all inputs where the homepage already renders newest-first
// (e.g. empty list, single item, or already correctly ordered input under F'),
// the fixed renderer MUST preserve every other behavior:
//   - empty-state message
//   - per-row time / text / truncation
//   - hover, click-to-open modal, copy-to-clipboard behavior
//   - 200-item cap from localStorage
//   - persistence and cloud-sync of new items
FOR ALL items WHERE NOT isBugCondition_SortOrder(items) DO
  ASSERT F(items) = F'(items)
END FOR
```

**Counterexamples (concrete reproductions):**

- Bug 1: Session starts. User presses F7 and says "write a leave letter for tomorrow." The AI returns text for the stale prompt about "Display recent items on the homepage from newest to oldest..." instead of a leave letter. Same outcome for F8 (grammar) and F9 (notes), and for F7-with-selection (rewrite).
- Bug 2: User issues commands in this order: `t1 = "hello"`, `t2 = "leave letter"`, `t3 = "summary of meeting"`. Homepage renders top-to-bottom as `"hello"`, `"leave letter"`, `"summary of meeting"`. Expected: `"summary of meeting"`, `"leave letter"`, `"hello"`.
