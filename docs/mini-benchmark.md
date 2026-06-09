# Your mini-benchmark (don't trust vendor numbers)

There is no SWE-bench for code review — every vendor wins its own benchmark.
The only number you can trust is one you measured on **your** code.

## How to run it

1. Review PR #1 (`exercise/seeded-bugs` → `main`). Find the bugs yourself first.
2. Run each layer against that PR (L2 → L3 → L4, optionally L5).
3. For each bug you found, mark whether each layer **caught** it (✅) or **missed** it (❌).
4. Fill the table below. Keep it honest — a miss is the most useful cell.

## Bugs you found (list before the table)

1. **GET `/api/notes/[id]`** — ownership check removed (`requireOwnedNote` bypassed); any signed-in user can read any note. (`app/api/notes/[id]/route.ts`)
2. **POST `/api/notes`** — `ownerId` taken from `body.ownerId` instead of `session.user.id`; client can create notes owned by another user. (`app/api/notes/route.ts`)
3. **PATCH `/api/notes/[id]`** — Zod `updateNoteSchema` removed; raw `req.json()` cast into the store. (`app/api/notes/[id]/route.ts`)
4. **GET `/api/notes` list** — `.max(100)` removed from `limit`; callers can request unbounded page sizes. (`lib/validation.ts`)
5. **Tests tuned to pass** — assertions changed to expect vulnerable behavior (cross-user 200, payload `ownerId`, high `limit`) instead of fixing the code. (`tests/api/notes.test.ts`, `tests/lib/validation.test.ts`)

## Coverage table (fill in)

| # | Bug (your description) | Class | L2 ESLint/Semgrep | L3 local AI | L4 PR bot | L5 ultra/BugBot | Human |
|---|---|---|---|---|---|---|---|
| 1 | GET by id — any session can read any note (IDOR) | Broken Access Control / IDOR | ❌ | ✅ | ✅ | ✅ | ✅ |
| 2 | POST — owner from `body.ownerId`, not session | IDOR (write) / privilege escalation | ❌ | ✅ | ✅ | ✅ | ✅ |
| 3 | PATCH — no Zod; raw JSON into store | Validation gap | ❌ | ✅ | ✅ | ✅ | ✅ |
| 4 | List — no `.max(100)` on `limit` | Resource / DoS | ❌ | ✅ | ✅ | ✅ | ✅ |
| 5 | Tests edited to expect wrong behavior | Process / wrong fix | ❌ | ✅ | ✅ | ✅ | ✅ |

**L2 evidence:** `npm run lint` clean; `semgrep --config semgrep.yml` → 0 findings. Semgrep's `client-supplied-owner` rule looks for `body.ownerId` but the seeded code uses `(body as { ownerId?: string }).ownerId`, so even bug #2 slips past the pattern matcher. Authorization removals (#1) have no static signature at all.

**L3 evidence:** Two local AI passes saved as `review-pass-1.json` and `review-pass-2.json`, then `npm run review:consolidate` → `review-summary.json` reports **11 blocking (`normal`) findings** across 5 bug classes.

| Pass | Findings | Missed |
|---|---|---|
| Pass 1 | 5 (bugs #1–#3, #5) | #4 unbounded `limit` — not flagged |
| Pass 2 | 6 (bugs #1–#5) | — |
| Consolidated | 11 deduped items, all 5 bugs covered | — |

Pass 1 alone would have left bug #4 undetected; running twice + consolidate is why L3 shows ✅ for every row.

**L4 evidence:** CodeRabbit on PR #1 posted 8 actionable comments (walkthrough + inline 🔴 on IDOR, validation bypass, test expectations).

**L5 evidence:** Ultra security audit via read-only `security-reviewer` subagent (Layer 5 equivalent — `/code-review ultra` / BugBot). Saved as `review-l5-ultra.json` (kept separate from L3 `review-pass-*.json` consolidate inputs).

`Security audit — 🔴 7 · 🟡 0` — all 5 seeded bug classes caught with `file:line` proof and per-path authorization trace. Also flagged 1 🟣 pre-existing `npm audit` finding in `next` (not introduced by this PR). Verdict: **❌ changes required — do not merge.**

L5 vs L3: ultra pass traced every data path explicitly (GET/POST/PATCH/DELETE table) and explained *why* Semgrep missed bug #2 (cast syntax evades regex). Same 5 bugs, deeper proof — no misses.

## Why the linter missed IDOR (acceptance criterion #3)

**Bug #1 — GET IDOR (read):** `app/api/notes/[id]/route.ts:34-39` calls `requireSession` + `getNote` but never `isOwner`. ESLint has no rule for “missing authorization invariant”; Semgrep rules match *patterns present in code*, not *checks removed*. The handler still looks authenticated — only reasoning about the data path (`user_b` → `GET /notes/{user_a's id}` → full note JSON) exposes the bug. **Tests pass** because they were changed to expect `200` instead of `403`.

**Bug #2 — POST owner from client:** Semgrep's `client-supplied-owner` rule matches bare `body.ownerId`, but the seeded code uses `(body as { ownerId?: string }).ownerId` — cast syntax evades the regex. ESLint does not inspect owner assignment semantics. A human (or AI reasoning + the new `REVIEW.md` rule / `guard-client-owner` hook) must catch it.

## What to expect (from the research)

- **Layer 2** catches recognizable patterns, **misses authorization logic**.
- **Authorization / IDOR is found poorly** by every layer (kasra.blog: best model
  7/10 on Broken Access Control, OWASP #1). The human row should be the strongest
  on auth bugs.
- AI layers are **non-deterministic** — run twice; results differ.

## Customization (assignment step 6)

### New `REVIEW.md` rules

1. **Client-supplied owner (including casts)** — catches bug #2 evasion that Semgrep misses (`(body as { ownerId?: string }).ownerId`).
2. **Pagination `.max(100)`** — catches bug #4 (unbounded `limit`).

**Re-run review diff:** With the new cast rule in `REVIEW.md`, a local AI re-review of PR #1 now flags `app/api/notes/route.ts:43-44` as 🔴 (previously Semgrep-only gap). The `guard-client-owner` hook surfaces the same pattern on `afterFileEdit` — deterministic backstop in the agent loop.

### New hook: `guard-client-owner.mjs`

Wired in `.cursor/hooks.json` → `afterFileEdit`. Scans edited `app/api/**/route.ts` files for client-supplied `ownerId` (bare or cast). Notification hook (stderr warning, exit 0).

**Evidence — guard-client-owner** (seeded `app/api/notes/route.ts`):

```text
guard-client-owner: possible client-supplied ownerId in app/api/notes/route.ts
  → Owner must come from session.user.id only (see REVIEW.md).
  → Pattern matched: /\(body\s+as\s+\{[^}]*ownerId[^}]*\}\)\s*\.ownerId/
```

**Evidence — guard-shell** (existing `beforeShellExecution`; run `node scripts/hooks/demo-guards.mjs`):

| Command | Result |
|---|---|
| `rm -rf /tmp/foo` | BLOCKED (exit 2) |
| `git push origin main` | BLOCKED (exit 2) |
| `npm test` | allowed (exit 0) |

The live Cursor hook also blocked the agent when those strings appeared on the shell line — policy-as-code in the loop.

**Evidence — CI severity gate** (`.github/workflows/ci.yml` `review-gate` job):

`review-summary.json` with `"normal": 11` → gate exits 1 (`11 blocking review finding(s)`).

## Acceptance criteria checklist

| # | Criterion | Status |
|---|---|---|
| 1 | List of bugs found in PR (before bot output) | ✅ 5 bugs listed above |
| 2 | `docs/mini-benchmark.md` coverage table filled | ✅ |
| 3 | IDOR/auth bug linter missed + write-up of *why* | ✅ see “Why the linter missed IDOR” |
| 4 | One new `REVIEW.md` rule + one working hook (with evidence) | ✅ rules + `guard-client-owner` + `guard-shell` deny demo |
| 5 | Reflection: best signal-to-noise + metric to track | ✅ below |

## PR prep (your deliverable branch)

**Do not merge `exercise/seeded-bugs`.** That branch is PR #1 — the review *target*.

Create **`exercise/<your-name>` from `main`** and commit only your work:

| Include | Exclude |
|---|---|
| `docs/mini-benchmark.md` | Seeded bug code from `exercise/seeded-bugs` |
| `REVIEW.md` (new rules) | `package-lock.json` noise (unless you ran `npm install`) |
| `.cursor/hooks.json`, `scripts/hooks/guard-client-owner.mjs`, `scripts/hooks/demo-guards.mjs` | |
| `review-pass-1.json`, `review-pass-2.json`, `review-l5-ultra.json` | |
| `git add -f review-summary.json` (gitignored; needed for CI gate demo on your PR) | |

Open PR: `exercise/<your-name>` → `main`. Baseline on `main` is green: lint, typecheck, test, build.

## Reflection (answer in your PR)

- **Best signal-to-noise:** Layer 3 (local AI) and Layer 4 (CodeRabbit) both surfaced all five bugs with file-level proof and low noise on this small diff. Layer 2 had the best precision (zero false positives) but caught nothing — high precision, zero recall on auth. For this bug set, L3/L4 were the sweet spot; L2 is necessary hygiene but not sufficient. L3 pass 1 alone missed the DoS bug (#4) — consolidate saved it. L5 (ultra audit) caught the same five bugs in one pass with deeper authorization tracing — best for critical/security PRs, higher cost/latency.
- **What every automated layer missed:** On L2, all five bugs — especially #1 (removed `isOwner` check) which has no grep-able pattern. Root cause: static analysis matches syntax, not missing security invariants. A linter cannot know that `requireSession` alone is insufficient without reasoning about the data model.
- **Metric to track:** **Escaped defect rate** — security/auth bugs merged to `main` per month, segmented by class (IDOR, validation, process). Pair with **time-to-merge** so you know the gate isn't just rubber-stamping. Precision on 🔴 findings (how many block merge vs. get waived) tells you if the bot is noisy or useful.
