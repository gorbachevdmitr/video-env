#!/usr/bin/env node
/**
 * Gate every video before it is sent to the pod.
 *
 *   node scripts/check.mjs          # all videos
 *   node scripts/check.mjs hello    # one video
 *
 * HyperFrames: runs `hyperframes check` (lint + runtime + layout + contrast) and compares the
 * root composition's data-duration with video.json.
 * Remotion: type-checks the project and compares Composition duration/fps with video.json.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VIDEOS_DIR = path.join(ROOT, "videos");

for (const p of [path.join(ROOT, ".bin"), path.join(ROOT, ".bin", "node", "bin")]) {
  if (existsSync(p)) process.env.PATH = `${p}${path.delimiter}${process.env.PATH}`;
}

function toolBin(pkgName) {
  const pkgJson = path.join(ROOT, "node_modules", pkgName, "package.json");
  if (!existsSync(pkgJson)) return null;
  const pkg = JSON.parse(readFileSync(pkgJson, "utf8"));
  const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin && pkg.bin[Object.keys(pkg.bin)[0]];
  if (!bin) return null;
  const file = path.resolve(path.dirname(pkgJson), bin);
  return existsSync(file) ? file : null;
}

function run(pkgName, args, cwd) {
  const bin = toolBin(pkgName);
  if (!bin) throw new Error(`${pkgName} is not installed. Run: npm ci`);
  const res = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8", env: process.env });
  return { code: res.status ?? 1, out: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

async function checkHyperframes(project, manifest, problems) {
  const res = run("hyperframes", ["check"], project.dir);
  if (res.code !== 0) {
    problems.push("hyperframes check failed");
    console.log(res.out.trim());
  } else {
    console.log("  ✓ hyperframes check");
  }

  const index = path.join(project.dir, "index.html");
  if (existsSync(index)) {
    const html = await readFile(index, "utf8");
    const rootTag = html.match(/data-composition-id="[^"]+"[\s\S]{0,400}?data-duration="([\d.]+)"/);
    const declared = rootTag ? Number(rootTag[1]) : null;
    if (declared !== null && typeof manifest.duration === "number") {
      const drift = Number((declared - manifest.duration).toFixed(2));
      if (Math.abs(drift) > 0.05) {
        problems.push(`root data-duration is ${declared}s but video.json says ${manifest.duration}s`);
      } else {
        console.log(`  ✓ duration ${declared}s matches video.json`);
      }
    }
  }
}

async function checkRemotion(project, manifest, problems) {
  const tsc = run("typescript", ["-p", project.dir, "--noEmit"], project.dir);
  if (tsc.code !== 0) {
    problems.push("tsc --noEmit failed");
    console.log(tsc.out.trim());
  } else {
    console.log("  ✓ tsc --noEmit");
  }

  const root = ["src/Root.tsx", "src/Root.ts"].map((f) => path.join(project.dir, f)).find(existsSync);
  if (root && typeof manifest.duration === "number") {
    const src = await readFile(root, "utf8");
    const fps = Number(src.match(/fps=\{(\d+)\}/)?.[1] ?? 0);
    const frames = Number(src.match(/durationInFrames=\{(\d+)\}/)?.[1] ?? 0);
    if (fps && frames) {
      const declared = Number((frames / fps).toFixed(2));
      const drift = Number((declared - manifest.duration).toFixed(2));
      if (Math.abs(drift) > 0.05) {
        problems.push(`Composition is ${declared}s (${frames}/${fps}) but video.json says ${manifest.duration}s`);
      } else {
        console.log(`  ✓ duration ${declared}s matches video.json`);
      }
    }
  }
}

async function main() {
  const wanted = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const entries = await readdir(VIDEOS_DIR, { withFileTypes: true });
  const projects = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = path.join(VIDEOS_DIR, e.name);
    if (!existsSync(path.join(dir, "video.json"))) continue;
    if (wanted.length && !wanted.includes(e.name)) continue;
    projects.push({ slug: e.name, dir });
  }

  if (!projects.length) {
    console.log("Nothing to check.");
    return 0;
  }

  let failed = 0;
  for (const project of projects) {
    const manifest = JSON.parse(await readFile(path.join(project.dir, "video.json"), "utf8"));
    const problems = [];
    console.log(`\n▶ ${project.slug} (${manifest.engine})`);
    try {
      if (manifest.engine === "hyperframes") await checkHyperframes(project, manifest, problems);
      else if (manifest.engine === "remotion") await checkRemotion(project, manifest, problems);
      else problems.push(`unknown engine "${manifest.engine}"`);
    } catch (err) {
      problems.push(err.message);
    }
    if (problems.length) {
      failed++;
      for (const p of problems) console.log(`  ✗ ${p}`);
    }
  }

  console.log(`\n${projects.length - failed}/${projects.length} passed`);
  return failed ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
