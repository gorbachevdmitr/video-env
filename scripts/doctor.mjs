#!/usr/bin/env node
/**
 * Is this machine able to author and render video?
 *
 *   node scripts/doctor.mjs
 *
 * Exit code 0 when everything mandatory is present, 1 otherwise. One line per check, and a hint
 * next to anything that is missing.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statfsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = [
  "hyperframes",
  "hyperframes-cli",
  "hyperframes-registry",
  "media-use",
  "ffmpeg-skill",
  "brag",
  "brag-slim",
  "remotion-templates",
];
const FFMPEG_FILTERS = ["drawtext", "subtitles", "loudnorm", "xfade", "overlay", "amix"];

for (const p of [path.join(ROOT, ".bin"), path.join(ROOT, ".bin", "node", "bin")]) {
  if (existsSync(p)) process.env.PATH = `${p}${path.delimiter}${process.env.PATH}`;
}

const rows = [];
const add = (state, name, detail, hint = "") => rows.push({ state, name, detail, hint });

function sh(cmd, args, { timeout = 20000 } = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout, env: process.env });
  return {
    code: r.status ?? (r.error ? 1 : 0),
    out: `${r.stdout ?? ""}${r.stderr ?? ""}`,
    error: r.error,
  };
}

function firstLine(s) {
  return (s || "").trim().split("\n")[0] ?? "";
}

// ---------- Node ----------
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor >= 22) add("ok", "node", `v${process.versions.node}`);
else add("fail", "node", `v${process.versions.node}`, "needs >= 22 — run: bash scripts/bootstrap.sh");

// ---------- FFmpeg ----------
const ff = sh("ffmpeg", ["-version"]);
if (ff.code === 0) {
  const version = firstLine(ff.out).match(/version\s+n?([\d.]+)/)?.[1] ?? "?";
  const major = Number(version.split(".")[0]);
  const where = firstLine(ff.out) ? "" : "";
  if (major >= 6) add("ok", "ffmpeg", `${version}${where}`);
  else add("fail", "ffmpeg", `${version} is too old`, "needs >= 6.1 — run: bash scripts/bootstrap.sh");

  const filters = sh("ffmpeg", ["-hide_banner", "-filters"]).out;
  const missing = FFMPEG_FILTERS.filter((f) => !new RegExp(`\\b${f}\\b`).test(filters));
  if (missing.length === 0) add("ok", "ffmpeg filters", FFMPEG_FILTERS.join(", "));
  else add("fail", "ffmpeg filters", `missing: ${missing.join(", ")}`, "use a full build (BtbN gpl / gyan.dev)");
} else {
  add("fail", "ffmpeg", "not found", "run: bash scripts/bootstrap.sh");
}

const fp = sh("ffprobe", ["-version"]);
add(fp.code === 0 ? "ok" : "fail", "ffprobe", fp.code === 0 ? "found" : "not found", "ships with ffmpeg");

// ---------- Python (ffmpeg-skill) ----------
let python = null;
for (const candidate of ["python3", "python"]) {
  const r = sh(candidate, ["-c", "import sys; print('.'.join(map(str, sys.version_info[:2])))"]);
  if (r.code === 0) {
    python = { cmd: candidate, version: r.out.trim() };
    break;
  }
}
if (python) {
  const [maj, min] = python.version.split(".").map(Number);
  if (maj > 3 || (maj === 3 && min >= 10)) add("ok", "python", `${python.cmd} ${python.version}`);
  else add("warn", "python", `${python.cmd} ${python.version}`, "ffmpeg-skill needs >= 3.10");
} else {
  add("warn", "python", "not found", "ffmpeg-skill needs python3 — apt-get install python3");
}

// ---------- Git ----------
const git = sh("git", ["--version"]);
add(git.code === 0 ? "ok" : "warn", "git", git.code === 0 ? firstLine(git.out) : "not found");

// ---------- Installed CLIs ----------
for (const [pkg, label] of [
  ["hyperframes", "hyperframes"],
  ["@remotion/cli", "remotion"],
]) {
  const installed = existsSync(path.join(ROOT, "node_modules", pkg, "package.json"));
  add(installed ? "ok" : "fail", label, installed ? "installed" : "missing", "run: npm ci");
}

// ---------- Skills ----------
const missingSkills = [];
for (const s of SKILLS) {
  if (!existsSync(path.join(ROOT, ".agents", "skills", s, "SKILL.md"))) missingSkills.push(s);
}
if (missingSkills.length === 0) add("ok", "skills", `${SKILLS.length} vendored`);
else add("fail", "skills", `missing: ${missingSkills.join(", ")}`, "restore .agents/skills from git");

// ---------- Chrome ----------
// Ask the HyperFrames CLI, but run it through node so this works the same on Windows and Linux
// (the .bin shim is a bash script on POSIX and a .cmd on Windows; neither is spawnable as-is).
function cliEntry(pkgName) {
  const pkgJson = path.join(ROOT, "node_modules", pkgName, "package.json");
  if (!existsSync(pkgJson)) return null;
  const pkg = JSON.parse(readFileSync(pkgJson, "utf8"));
  const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin && pkg.bin[Object.keys(pkg.bin)[0]];
  return bin ? path.resolve(path.dirname(pkgJson), bin) : null;
}

const hyperframesEntry = cliEntry("hyperframes");
if (hyperframesEntry && existsSync(hyperframesEntry)) {
  const r = spawnSync(process.execPath, [hyperframesEntry, "doctor", "--json"], {
    encoding: "utf8",
    timeout: 180000,
    env: process.env,
  });
  let parsed = null;
  const start = (r.stdout ?? "").indexOf("{");
  if (start >= 0) {
    try {
      parsed = JSON.parse(r.stdout.slice(start));
    } catch {
      /* keep null */
    }
  }
  const chrome = parsed?.checks?.find((c) => c.name === "Chrome");
  if (chrome?.ok === true) add("ok", "chrome", "headless Chrome found");
  else if (chrome) add("warn", "chrome", chrome.detail || "not ready", "npx hyperframes browser ensure");
  else add("warn", "chrome", "unknown", "npx hyperframes browser ensure");
} else {
  add("warn", "chrome", "not checked", "install deps first");
}

// ---------- Disk ----------
try {
  const st = statfsSync(ROOT);
  const freeGB = (st.bavail * st.bsize) / 1e9;
  if (freeGB >= 5) add("ok", "disk", `${freeGB.toFixed(1)} GB free`);
  else add("warn", "disk", `${freeGB.toFixed(1)} GB free`, "renders need room; clean out/ or .hyperframes/");
} catch {
  add("warn", "disk", "unknown");
}

// ---------- Report ----------
const icon = { ok: "✓", warn: "!", fail: "✗" };
const width = Math.max(...rows.map((r) => r.name.length));
console.log(`\nvideo-env doctor — ${ROOT}\n`);
for (const r of rows) {
  console.log(
    `  ${icon[r.state]} ${r.name.padEnd(width)}  ${r.detail}${r.state !== "ok" && r.hint ? `   → ${r.hint}` : ""}`,
  );
}

const failed = rows.filter((r) => r.state === "fail");
const warned = rows.filter((r) => r.state === "warn");
console.log(
  `\n${rows.length - failed.length - warned.length} ok, ${warned.length} warnings, ${failed.length} failures`,
);
if (failed.length) console.log("Fix the failures before authoring: bash scripts/bootstrap.sh\n");
process.exit(failed.length ? 1 : 0);
