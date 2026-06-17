# PR #1 Review Report

Target: `exercise/seeded-bugs` compared with `main`.

Baseline evidence: on `main`, `npm install` initially hit a Windows `EPERM` cleanup/spawn error, then passed on retry with elevated permissions. `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` all passed on `main`.

Branch evidence: on `oleh-homework` / `exercise/seeded-bugs`, `npm run lint`, `npm run typecheck`, and `npm test` passed. Passing tests are not a correctness signal here because several tests were changed to assert insecure behavior.

## Findings

### 1. POST trusts client-supplied `ownerId`

- Severity: High
- File: `app/api/notes/route.ts`
- Lines: 43-45
- Explanation: `POST /api/notes` reads `(body as { ownerId?: string }).ownerId` and passes it to `createNote`. `lib/notes.ts:55-67` stores the provided owner directly. An authenticated user can create a note owned by another user, which violates the project rule that owners come from `session.user.id`, never client input.
- Suggested fix: remove the `ownerId` fallback and call `createNote(session.user.id, parsed.data)`.

### 2. GET by id skips the ownership guard

- Severity: High
- File: `app/api/notes/[id]/route.ts`
- Lines: 34-39
- Explanation: `GET /api/notes/[id]` calls `requireSession(req)` and then `getNote(id)`, but does not call `requireOwnedNote` or `isOwner`. Any authenticated user who knows a note id can read another user's note. The existing helper at lines 19-28 already implements the correct 404/403 behavior.
- Suggested fix: replace the session-plus-raw-lookup path with `const note = requireOwnedNote(req, id)`.

### 3. PATCH bypasses Zod validation and sends raw JSON to the store

- Severity: High
- File: `app/api/notes/[id]/route.ts`
- Lines: 51-52
- Explanation: The route parses raw JSON, casts it to `UpdateNoteInput`, and passes it to `updateNote`. This removes the `updateNoteSchema.safeParse` check from `main`, allowing empty updates, over-long fields, wrong types, and `null` to reach domain logic. `updateNote` reads `input.title` and `input.body` in `lib/notes.ts:71-79`, so malformed bodies can also turn into unhandled server errors.
- Suggested fix: import `badRequest` and `updateNoteSchema`, validate with `safeParse`, return 400 on failure, and pass only `parsed.data` to `updateNote`.

### 4. List limit is no longer capped

- Severity: Medium
- File: `lib/validation.ts`
- Line: 24
- Explanation: `listQuerySchema` removed `.max(100)`. `GET /api/notes` passes `parsed.data.limit` to `listNotes` in `app/api/notes/route.ts:20-24`, and `listNotes` uses it in `slice(offset, offset + limit)` at `lib/notes.ts:52`. Very large limits can request unbounded in-memory work and response payloads.
- Suggested fix: restore `.max(100)` and keep the validation test that rejects `limit=500`.

### 5. Tests were changed to bless insecure ownership behavior

- Severity: High
- File: `tests/api/notes.test.ts`
- Lines: 43-53
- Explanation: The previous security regression test expected the created note owner to be the session user. The seeded branch now expects the payload `ownerId` to win, so CI passes while encoding the broken access-control behavior.
- Suggested fix: restore the test name and assertion so payload `ownerId` is ignored and `data.note.ownerId` is `user_a`.

### 6. Tests were changed to bless cross-user reads

- Severity: High
- File: `tests/api/notes.test.ts`
- Lines: 57-72
- Explanation: The test now expects user B to receive 200 when reading user A's note. That directly contradicts the record-by-id rule in `REVIEW.md` and hides the IDOR introduced in `app/api/notes/[id]/route.ts`.
- Suggested fix: restore the 403 test for another user's note and keep the owner happy path.

### 7. Tests were changed to accept unbounded list limits

- Severity: Medium
- File: `tests/lib/validation.test.ts`
- Lines: 52-53
- Explanation: The test now expects `limit=500` to pass, matching the removed cap. This makes the resource-limit regression look intentional.
- Suggested fix: restore the test that rejects `limit=500`.

### 8. PATCH route lacks regression coverage for validation failures

- Severity: Medium
- File: `tests/api/notes.test.ts`
- Lines: 1-116
- Explanation: The API tests import `GET` for the by-id route but not `PATCH`, and there is no route-level test for invalid PATCH bodies returning 400. That gap allowed the validation bypass in `app/api/notes/[id]/route.ts:51-52` to pass the suite.
- Suggested fix: add PATCH tests for owner success, 401 unauthenticated, 403 non-owner, and 400 invalid body.
