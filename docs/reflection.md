# Reflection

1. Which bugs were hardest to detect?

The hardest bugs were the authorization regressions that still looked structurally correct: `GET /api/notes/[id]` still called `requireSession`, and `POST /api/notes` still used Zod for the visible body shape. The real issue required following the data path from route handler to store and comparing the behavior with `main`.

2. Which review layer was most useful?

Layer 3 was most useful because it combined exact code reading with security reasoning. It caught the IDOR, client owner control, validation bypass, resource limit regression, and tests that were changed to make those bugs pass.

3. Which bugs were missed by static analysis?

ESLint missed all seeded bugs. Semgrep did not run in this environment (`npm error could not determine executable to run`). Even if it had run, the configured `client-supplied-owner` rule would likely miss `(body as { ownerId?: string }).ownerId`, and static analysis would still struggle with the missing ownership check in `GET /api/notes/[id]`.

4. What metric would you track in production to measure review quality?

I would track escaped review defects by class, especially access-control and validation defects found after merge. I would pair that with review finding acceptance rate so the team can see whether automated review is producing actionable signal or noise.

5. Should AI review be blocking or advisory?

AI review should be advisory by default, but high-confidence, repo-specific policy violations can become blocking through deterministic gates. For this repo, a consolidated `normal` security finding should block merge until a human reviews and either fixes it or explicitly downgrades it with evidence.
