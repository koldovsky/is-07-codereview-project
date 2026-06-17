# Layer 4 PR Bot Simulation

Style: CodeRabbit-like PR review focused on security, logic, maintainability, and test coverage.

## Summary

Tally - High 5, Medium 3, Low 0

Verdict: changes required. This PR introduces broken access control, validation bypasses, and tests that assert the vulnerable behavior.

## Blocking comments

### High: client controls note ownership

`app/api/notes/route.ts:43-45`

The route validates `title` and `body`, but then reads `ownerId` from the raw body and passes it to `createNote`. Since `createNote` stores the owner it receives, a user can create records under another user's id. Use `session.user.id` only.

### High: by-id note reads are IDOR-prone

`app/api/notes/[id]/route.ts:34-39`

The GET handler no longer uses `requireOwnedNote`; it only checks that some session exists. This allows any authenticated user to read any known note id. Use the existing helper so unknown ids return 404 and non-owner ids return 403.

### High: PATCH bypasses request validation

`app/api/notes/[id]/route.ts:51-52`

The route casts raw JSON to `UpdateNoteInput`. TypeScript casts do not validate runtime input. Restore `updateNoteSchema.safeParse` and return `badRequest` on invalid bodies.

### Medium: unbounded list limit

`lib/validation.ts:24`

Removing `.max(100)` allows very large list requests. Restore the cap to keep response size and in-memory work bounded.

### High: tests encode vulnerable behavior

`tests/api/notes.test.ts:43-53`, `tests/api/notes.test.ts:57-72`, `tests/lib/validation.test.ts:52-53`

The tests were changed to expect payload owner control, cross-user by-id reads, and unbounded list limits. These are not harmless expectation updates; they convert security regressions into green CI.

### Medium: missing PATCH route coverage

`tests/api/notes.test.ts:1-116`

There are no route-level PATCH tests for invalid input. Add happy path, 401, 403, and 400 cases so validation regressions are caught at the API boundary.
