# Your mini-benchmark (don't trust vendor numbers)

There is no SWE-bench for code review — every vendor wins its own benchmark.
The only number you can trust is one you measured on **your** code.

## How to run it

1. Review PR #1 (`exercise/seeded-bugs` → `main`). Find the bugs yourself first.
2. Run each layer against that PR (L2 → L3 → L4, optionally L5).
3. For each bug you found, mark whether each layer **caught** it (✅) or **missed** it (❌).
4. Fill the table below. Keep it honest — a miss is the most useful cell.

## Bugs you found (list before the table)

1. `app/api/notes/[id]/route.ts:31` — GET handler dropped `requireOwnedNote`/
   `isOwner`; any authenticated user can read any other user's note (IDOR, read).
2. `app/api/notes/route.ts:43` — POST takes `ownerId` from the client body
   (`(body as { ownerId?: string }).ownerId ?? session.user.id`) instead of
   always using `session.user.id` (IDOR, write).
3. `app/api/notes/[id]/route.ts:52` — PATCH dropped
   `updateNoteSchema.safeParse(body)`; raw (possibly `null`) body is cast to
   `UpdateNoteInput` and passed straight to `updateNote` (validation gap).
4. `lib/validation.ts:24` — `listQuerySchema.limit` lost its `.max(100)`
   clamp; `GET /api/notes?limit=<huge>` is now accepted (resource / DoS).
5. `tests/api/notes.test.ts:43-53` — the "owns the note via session, not
   payload" test was rewritten to assert the attacker-supplied
   `ownerId: "user_b"` is honored — masks bug #2 (test edited to pass).
6. `tests/api/notes.test.ts:57-72` — the "GET /api/notes/[id] (IDOR guard)"
   test was renamed and its expectation flipped from `403` to `200` for a
   cross-user fetch — masks bug #1 (test edited to pass).
7. `tests/lib/validation.test.ts:52-53` — "clamps limit to the max of 100" was
   rewritten to assert `limit: "500"` is now *accepted* — masks bug #4 (test
   edited to pass).

## Coverage table (fill in)

| # | Bug (your description) | Class | L2 ESLint/Semgrep | L3 local AI | L4 PR bot | L5 ultra/BugBot | Human |
|---|---|---|---|---|---|---|---|
| 1 | GET /api/notes/[id] — no ownership check, any session can read any note | Broken Access Control / IDOR (read) | ❌ | ✅ | ⏭️ (skipped) | — | ✅ |
| 2 | POST /api/notes — owner taken from `body.ownerId` instead of session | IDOR (write) / Broken Access Control | ❌¹ | ✅ | ⏭️ (skipped) | — | ✅ |
| 3 | PATCH /api/notes/[id] — `updateNoteSchema.safeParse` removed, raw body cast | Validation gap | ❌ | ✅ | ⏭️ (skipped) | — | ✅ |
| 4 | `listQuerySchema.limit` lost `.max(100)` | Resource / DoS | ❌ | ✅ | ⏭️ (skipped) | — | ✅ |
| 5 | POST test flipped to expect `ownerId: "user_b"` | Process / test edited to pass (masks #2) | ❌ | ✅ (both passes) | ⏭️ (skipped) | — | ✅ |
| 6 | GET IDOR guard test flipped `403` → `200` | Process / test edited to pass (masks #1) | ❌ | ✅ (both passes) | ⏭️ (skipped) | — | ✅ |
| 7 | limit-clamp test flipped to accept `limit: "500"` | Process / test edited to pass (masks #4) | ❌ | ✅ (pass 2 only)² | ⏭️ (skipped) | — | ✅ |

¹ `semgrep.yml`'s `client-supplied-owner` rule targets exactly this pattern
(`\b(body|...)\.ownerId\b`) but the seeded code wraps the access in a type
cast — `(body as { ownerId?: string }).ownerId` — which doesn't match the
regex token sequence. The rule exists but is evaded.

² Ran `/code-review high` twice and consolidated
(`npm run review:consolidate`). Bugs #1-4 and #5-6 were found in **both**
passes; bug #7 was found in only **one** of the two passes — concrete
evidence of L3 non-determinism on this PR. L4 (CodeRabbit/PR bot) was skipped
for this run. L5 not run.

## Why the linter missed bug #1 (IDOR read) — write-up

`app/api/notes/[id]/route.ts`'s `GET` handler was changed from:

```ts
const note = requireOwnedNote(req, id); // session + lookup + isOwner + 403/404
```

to:

```ts
requireSession(req);
const note = getNote(id);
if (!note) throw notFound("Note not found");
```

Both versions: import cleanly, type-check (`Note | undefined` is narrowed by
the `if (!note)` guard), pass ESLint (no rule fires on "a function call was
removed"), and pass Semgrep (`semgrep.yml` has no rule for "ownership check
missing" — its own header says so: *"these catch recognizable patterns. They
CANNOT reason about whether an authorization check is missing"*). The test
suite even stays green, because the matching test (bug #6) was edited to
expect `200` instead of `403`.

**Why a human/AI had to reason about it**: catching this requires knowing
(a) that `requireOwnedNote` *is* the ownership check for this resource type,
(b) that `getNote(id)` alone returns *any* note regardless of caller, and
(c) the project convention ("every record returned by id MUST pass an
ownership check") — none of which is visible from the changed lines in
isolation. It's a **removed-behavior** bug: the diff is syntactically valid
and the deleted call's *absence* is the defect. Pattern matchers compare
tokens against a list of bad patterns; they don't compare "what guarantees
did this function provide before vs. after." Only Layer 3 (AI reasoning
about the diff + cross-file context) and the human catch it (Layer 4/5 not
run here).

## Customization: new rule + hook

- **New `REVIEW.md` rule** (Repo-specific checks): any Zod field bounding a
  client-controlled resource (pagination `limit`/`offset`, etc.) must declare
  `.max()`; missing it is 🔴, even if the field still validates as a number.
  - *Before/after demo*: asked an agent to classify bug #4
    (`lib/validation.ts:24`, missing `.max(100)`) against the **old**
    REVIEW.md → **🟡** (none of the 5 enumerated 🔴 categories match — Zod
    `parse` still runs, so "unvalidated input reaching the store" doesn't
    fire). Against the **new** REVIEW.md → **🔴** (matches the new rule by
    name). Same finding, same code — the explicit rule changes the verdict
    from non-blocking to blocking.
- **New hook** (`scripts/hooks/guard-shell.mjs`): added a `reviewGateHit()`
  check, wired into the existing `beforeShellExecution` /
  `PreToolUse(Bash)` guard. It blocks `git commit` whenever
  `review-summary.json` (the same artifact CI's `review-gate` job reads)
  reports `normal > 0`.
  - *Deny in action* (this session, `review-summary.json` had `"normal": 9`):

    ```text
    $ git commit -m "test commit to demonstrate review-gate hook"
    PreToolUse:Bash hook error: [node scripts/hooks/guard-shell.mjs]:
    guard-shell: blocked — Commit blocked: review-summary.json reports 9
    blocking (🔴) finding(s). Resolve them or delete review-summary.json
    before committing.
    ```

- **CI gating**: already implemented on `main` (`.github/workflows/ci.yml`
  `review-gate` job — fails when `review-summary.json`'s `normal > 0`). No CI
  changes needed: the new rule's findings flow through the same
  `review-summary.json` contract, so the existing job gates on it for free.
  Verified the job's exact shell logic locally against our
  `review-summary.json` → `Blocking findings: 9` → would `exit 1`.

## What to expect (from the research)

- **Layer 2** catches recognizable patterns, **misses authorization logic**.
- **Authorization / IDOR is found poorly** by every layer (kasra.blog: best model
  7/10 on Broken Access Control, OWASP #1). The human row should be the strongest
  on auth bugs.
- AI layers are **non-deterministic** — run twice; results differ.

## Reflection (answer in your PR)

- **Which layer gave the best signal-to-noise for your bug set?** Layer 3
  (local AI review, 2 passes + consolidation): 7/7 bugs caught, only 3 nits
  (well under the 5-nit cap), zero false positives after the 1-vote verify
  step. Layer 2 had perfect precision but **zero recall** on this bug set
  (0/7) — its 3 rules target patterns this PR doesn't exhibit exactly.
- **Which bug did every automated layer miss, and why?** Both Layer 2
  candidates miss bug #1 (GET IDOR) for the same root reason: it's a
  **removed-behavior** bug (an `isOwner`/`requireOwnedNote` call deleted, not
  a bad pattern added). ESLint/Semgrep only match patterns present in the new
  code; there's nothing "wrong-shaped" to match — the defect is an absence
  that requires knowing the project's ownership-check convention. Only
  Layer 3 (and the human) caught it.
- **Which metric would you track to know review is working?** **Escaped
  defects** (bugs found in prod/later review that an earlier layer should
  have caught, bucketed by class — esp. IDOR/auth) over **precision** at each
  layer (Layer 2 precision is moot here since it found 0; Layer 3's 1-vote
  verify kept precision at 8/8 and 7/8 candidates across the two passes). A
  pure "review caught N issues" count rewards noisy layers; escaped-defects
  rate tied to the 🔴 classes in `REVIEW.md` directly measures whether the
  pyramid is preventing the bug classes it claims to.
