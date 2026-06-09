#!/usr/bin/env node
/**
 * Client-owner guard — policy-as-code for the Semgrep blind spot.
 *
 * Fires on `afterFileEdit` when an API route file changes. Scans for owner
 * assignments from the request body (bare `body.ownerId` OR cast evasions like
 * `(body as { ownerId?: string }).ownerId`). Surfaces a warning on stderr so
 * the agent sees it; never blocks (exit 0).
 *
 * Workshop tie-in: seeded bug #2 uses the cast form — Semgrep misses it, this
 * hook does not.
 */

import { readFileSync, existsSync } from "node:fs";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function extractPath(payload) {
  if (!payload || typeof payload !== "object") return "";
  return payload.file_path ?? payload.tool_input?.file_path ?? "";
}

const ROUTE = /(?:^|\/)app\/api\/.*\/route\.(?:ts|js)$/;
// Workshop scope: catch seeded bug #2 and common evasions. Not exhaustive —
// e.g. indirect casts via typed aliases may still slip through.
const CLIENT_OWNER = [
  /\b(body|data|payload|input|req|request)\.ownerId\b/,
  /\(body\s+as\s+\{[\s\S]*?ownerId[\s\S]*?\}\)\s*\.ownerId/,
  /\(body\s+as\s+any\s*\)\s*\.ownerId/,
  /\bconst\s+\{\s*ownerId\b[^=]*=\s*(body|data|payload)\b/,
];

function main() {
  const raw = readStdin();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const filePath = String(extractPath(payload) || "");
  if (!filePath || !ROUTE.test(filePath)) process.exit(0);
  if (!existsSync(filePath)) process.exit(0);

  const content = readFileSync(filePath, "utf8");
  const hit = CLIENT_OWNER.find((re) => re.test(content));
  if (!hit) process.exit(0);

  process.stderr.write(
    `guard-client-owner: possible client-supplied ownerId in ${filePath}\n` +
      `  → Owner must come from session.user.id only (see REVIEW.md).\n` +
      `  → Pattern matched: ${hit}\n`,
  );
  process.exit(0);
}

main();
