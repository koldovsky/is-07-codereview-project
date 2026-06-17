# Mini Benchmark

Target: `exercise/seeded-bugs` vs `main`.

Layer 2 evidence: `npm run lint` passed. `npx semgrep --config semgrep.yml` and `npx --yes semgrep --config semgrep.yml` both failed with `npm error could not determine executable to run`, so Semgrep produced no runtime findings in this environment. Based on `semgrep.yml`, the `client-supplied-owner` regex would not match `(body as { ownerId?: string }).ownerId` because the configured pattern looks for direct `.ownerId` on names such as `body.ownerId`.

Layer 3 evidence: two local passes were consolidated with `npm run review:consolidate`, producing 7 normal findings.

Layer 4 evidence: simulated PR bot review caught the security, logic, maintainability, and coverage issues listed in `docs/layer4-review.md`.

| Bug | Layer 2 | Layer 3 | Layer 4 |
|------|----------|----------|----------|
| POST trusts payload `ownerId` (`app/api/notes/route.ts:43-45`) | Missed | Caught | Caught |
| GET by id skips ownership check (`app/api/notes/[id]/route.ts:34-39`) | Missed | Caught | Caught |
| PATCH bypasses Zod validation (`app/api/notes/[id]/route.ts:51-52`) | Missed | Caught | Caught |
| List limit cap removed (`lib/validation.ts:24`) | Missed | Caught | Caught |
| Tests assert payload owner control (`tests/api/notes.test.ts:43-53`) | Missed | Caught | Caught |
| Tests assert cross-user reads (`tests/api/notes.test.ts:57-72`) | Missed | Caught | Caught |
| Tests assert unbounded limit (`tests/lib/validation.test.ts:52-53`) | Missed | Caught | Caught |
| PATCH invalid-body route coverage missing (`tests/api/notes.test.ts:1-116`) | Missed | Caught | Caught |

## Conclusion

Layer 3 had the best signal-to-noise ratio for this branch: it found the main authorization and validation issues and connected them to changed tests. Layer 4 produced similar findings with stronger PR-comment framing. Layer 2 had the lowest signal here: ESLint passed, Semgrep did not run in this environment, and the configured Semgrep owner rule was too narrow for the cast-based owner access pattern. Layer 2 also produced the most operational noise because Semgrep failed before scanning.
