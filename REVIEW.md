# REVIEW.md — review-only rules (highest priority)

> This file is injected into the system prompt of every review agent as the
> **highest-priority** instruction set. It is read by Claude Code review and used
> as guidance by Cursor/CodeRabbit. Keep it short — a long REVIEW.md dilutes the
> rules that matter. `@`-imports are NOT expanded; write rules directly here.

## Severity for THIS repo

- 🔴 **Important (blocks merge)** — only:
  - Missing authorization on a data path (IDOR / Broken Access Control).
  - Owner taken from client input (`body.ownerId`, `params.userId`) instead of `session.user.id`.
  - Unvalidated request input reaching the store (no Zod `safeParse`/`parse`).
  - A leaked secret, or a real stack trace / internal message returned to the client.
  - A test changed to pass instead of a fixed bug.
- 🟡 **Nit (non-blocking)** — style, naming, micro-perf, comments.
- 🟣 **Pre-existing** — already on `main`; flag separately, do not block this PR.

## Verification bar (reduce false positives)

Before reporting a 🔴 **authorization** or **validation** finding, cite the exact
`file:line` of the missing check and name the data path that is exposed. No proof,
no 🔴 — downgrade to a question in the summary.

## Repo-specific checks

- Every new `app/api/**/route.ts` that mutates (POST/PATCH/PUT/DELETE) MUST call
  `requireSession(req)` (or load via `requireOwnedNote`) BEFORE touching the store.
- Every record returned by id MUST pass an ownership check (`isOwner`) — return
  404 for unknown ids, 403 for someone else's record.
- Every handler that reads `req.json()` or search params MUST validate via a Zod
  schema from `lib/validation.ts`.
- Tests in auth-sensitive routes MUST preserve the security invariant from
  `main`: cross-user access is 403, client `ownerId` is ignored, and list limits
  stay capped. Why: a test that asserts insecure behavior makes green CI a false
  signal and must block merge.
- New routes MUST have at least: a happy-path test, a 401 test, and a 400 test.
- Errors return via `lib/errors.ts` helpers — never raw `throw new Error(...)`
  surfaced to the client.

## Nit volume

Max **5** 🟡 nits inline. Summarize the rest as a single count line. Do not
nit-pick anything ESLint/Prettier/Semgrep already enforce (see Skip rules).

## Skip rules (do not comment)

- `node_modules/**`, `.next/**`, `dist/**`, `coverage/**`, lockfiles.
- Generated files, `*.tsbuildinfo`, `review-*.json` artifacts.
- Formatting handled by Prettier; lint rules handled by ESLint.

## Re-review convergence

On a re-review of the same PR, report 🔴 Important only. Mute nits already raised.

## Summary shape

Start the summary with a tally line:

`Tally — 🔴 <n> · 🟡 <n> · 🟣 <n>`

Then: the blocking findings (with `file:line`), then a one-line verdict
(✅ mergeable / ❌ changes required).
