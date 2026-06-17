#!/usr/bin/env node
/**
 * Shell guard hook — policy-as-code (Layer 1 enforced inside the agent loop).
 *
 * Works in BOTH Cursor (`beforeShellExecution`) and Claude Code (`PreToolUse`
 * with matcher `Bash`). It reads the proposed command from stdin (the payload
 * shape differs per tool, so we check both), and BLOCKS dangerous commands.
 *
 * Blocking mechanism (portable across both tools):
 *   - exit code 2  → block the command
 *   - also emit Cursor's deny JSON on stdout (ignored by Claude on exit 2)
 *
 * Denied: `rm -rf`, PowerShell recursive force delete, force-push, push to a
 * protected branch, writes to `.env`.
 * Everything else is allowed (fail-open: on parse error we allow + exit 0).
 */

import { readFileSync } from "node:fs";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function extractCommand(payload) {
  if (!payload || typeof payload !== "object") return "";
  // Cursor: { command }, Claude: { tool_input: { command } }
  return payload.command ?? payload.tool_input?.command ?? "";
}

const DANGER = [
  { re: /\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/i, why: "Recursive force delete (rm -rf) is blocked." },
  { re: /\bRemove-Item\b[\s\S]*(\s-Recurse\b|\s-r\b)[\s\S]*(\s-Force\b|\s-f\b)/i, why: "Recursive force delete (Remove-Item -Recurse -Force) is blocked." },
  { re: /git\s+push\s+.*(--force\b|-f\b|--force-with-lease)/i, why: "Force-push is blocked. Open a PR instead." },
  { re: /git\s+push\s+\S+\s+(HEAD:)?(main|master)\b/i, why: "Direct push to main/master is blocked. Open a PR." },
  { re: /git\s+push(\s+origin)?(\s+(main|master))?\s*$/i, why: "Push to the default branch is blocked. Open a PR." },
  { re: /(^|[\s;|&>])(>|>>)\s*\.env(\.|\b)/i, why: "Writing to .env files is blocked (secret-leak guard)." },
];

function main() {
  const raw = readStdin();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0); // can't parse → fail open
  }

  const command = String(extractCommand(payload) || "");
  if (!command) process.exit(0);

  const hit = DANGER.find((d) => d.re.test(command));
  if (!hit) process.exit(0);

  // Cursor-format deny (used when exit code is 0; harmless on exit 2).
  process.stdout.write(
    JSON.stringify({
      continue: true,
      permission: "deny",
      user_message: hit.why,
      agent_message: `Blocked by guard-shell hook: ${hit.why} Command: ${command}`,
    }),
  );
  // stderr is surfaced to the model by Claude Code on exit 2.
  process.stderr.write(`guard-shell: blocked — ${hit.why}\n`);
  process.exit(2);
}

main();
