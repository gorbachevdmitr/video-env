#!/usr/bin/env node
/**
 * End-to-end smoke test: drafts every video and reports what came out.
 *
 *   node scripts/smoke.mjs
 *
 * Use after bootstrap, on a fresh pod, or after changing anything in scripts/.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const res = spawnSync(
  process.execPath,
  [path.join(ROOT, "scripts", "render.mjs"), "--all", "--quality", "draft", "--json"],
  { cwd: ROOT, encoding: "utf8", env: process.env, stdio: ["ignore", "pipe", "inherit"] },
);

if (res.status !== 0) {
  console.error("\n✗ smoke test failed: at least one video did not render");
  process.exit(1);
}

// The JSON summary is the last line that starts with "[" — renderer progress is also on stdout.
const match = res.stdout.match(/^\[[\s\S]*\]\s*$/m);
let results = [];
if (match) {
  try {
    results = JSON.parse(match[0]);
  } catch {
    console.error("\n✗ smoke test: could not parse the render summary");
    process.exit(1);
  }
}
console.log("\nSmoke summary");
for (const r of results) {
  const sheet = r.contactSheet && existsSync(path.join(ROOT, r.contactSheet)) ? " + sheet" : "";
  console.log(`  ✓ ${r.slug}: ${r.width}x${r.height}, ${r.duration}s, ${r.sizeMB} MB${sheet}`);
}
console.log("\n✓ environment renders. Next: bash scripts/bootstrap.sh on a pod, then node scripts/render.mjs --all");
