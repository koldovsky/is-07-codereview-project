# Hooks Report

Implemented hook: strengthened `scripts/hooks/guard-shell.mjs`.

Existing wiring:

- Cursor: `.cursor/hooks.json` runs `node scripts/hooks/guard-shell.mjs` before shell execution.
- Claude Code: `.claude/settings.json` runs the same script as a `PreToolUse` hook for Bash.

Change made for this assignment: the shell guard now blocks PowerShell recursive force deletion in addition to Unix `rm -rf`, force pushes, direct pushes to `main` / `master`, and writes to `.env` files.

## Evidence

Blocked PowerShell destructive delete:

```text
Command:
'{"command":"Remove-Item -LiteralPath temp -Recurse -Force"}' | node scripts/hooks/guard-shell.mjs

Result:
permission: deny
Recursive force delete (Remove-Item -Recurse -Force) is blocked.
```

Blocked direct push to `main`:

```text
Command:
'{"command":"git push origin main"}' | node scripts/hooks/guard-shell.mjs

Result:
permission: deny
Direct push to main/master is blocked. Open a PR.
```

Allowed normal command:

```text
Command:
'{"command":"npm run lint"}' | node scripts/hooks/guard-shell.mjs

Result:
exit code 0, no deny message
```

Lint-on-edit hook still runs successfully for the edited hook file:

```text
Command:
'{"file_path":"scripts/hooks/guard-shell.mjs"}' | node scripts/hooks/lint-changed.mjs

Result:
exit code 0
```
