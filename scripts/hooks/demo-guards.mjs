#!/usr/bin/env node
/**
 * Demo script for workshop evidence — runs guard-shell cases without putting
 * dangerous command strings on the agent's shell line (which would trip the
 * live beforeShellExecution hook).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const guard = join(dir, "guard-shell.mjs");

function run(label, command) {
  const result = spawnSync("node", [guard], {
    input: JSON.stringify({ command }),
    encoding: "utf8",
  });
  const blocked = result.status === 2;
  console.log(`${label}: ${blocked ? "BLOCKED" : "allowed"} (exit ${result.status})`);
  if (result.stdout) console.log(`  stdout: ${result.stdout.trim()}`);
  if (result.stderr) console.log(`  stderr: ${result.stderr.trim()}`);
}

console.log("guard-shell demo\n");
run("recursive delete", "rm -rf /tmp/foo");
run("push to main", "git push origin main");
run("safe command", "npm test");
