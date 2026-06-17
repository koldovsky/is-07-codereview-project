# Layer 3 Local AI Review

Target: `exercise/seeded-bugs` vs `main`.

Method: I performed two independent local review passes over the diff, then encoded the findings as temporary `review-pass-a.json` and `review-pass-b.json` inputs and ran `npm run review:consolidate`.

Consolidation evidence:

```text
Tally - normal 7, nit 0, pre_existing 0
Wrote review-findings.json (7) + review-summary.json
Blocking findings present (normal > 0).
```

## Pass A: Authorization and validation first

- Caught: `POST /api/notes` trusts payload `ownerId` at `app/api/notes/route.ts:43-45`.
- Caught: `GET /api/notes/[id]` authenticates but does not call `requireOwnedNote` at `app/api/notes/[id]/route.ts:34-39`.
- Caught: `PATCH /api/notes/[id]` casts raw JSON to `UpdateNoteInput` at `app/api/notes/[id]/route.ts:51-52`.
- Caught: `listQuerySchema` removed the `limit` cap at `lib/validation.ts:24`.

## Pass B: Tests and regression evidence first

- Caught: `tests/api/notes.test.ts:43-53` now expects payload owner control.
- Caught: `tests/api/notes.test.ts:57-72` now expects cross-user read access.
- Caught: `tests/lib/validation.test.ts:52-53` now accepts `limit=500`.
- Caught: the same PATCH validation bypass at `app/api/notes/[id]/route.ts:51-52`.

## Consolidated findings

1. High: client-supplied `ownerId` can assign notes to another user.
2. High: by-id GET exposes any note to any authenticated user.
3. High: PATCH sends unvalidated request JSON to the store.
4. Medium: list pagination limit is unbounded.
5. High: owner test was changed to assert insecure behavior.
6. High: IDOR test was changed to assert insecure behavior.
7. Medium: limit test was changed to assert insecure behavior.

Layer 3 had the best human-readable explanation quality because it connected test changes to the code regressions. It still depended on manual evidence gathering from the diff and exact lines.
