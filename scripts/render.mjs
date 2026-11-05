#!/usr/bin/env node
/**
 * Render one or all videos listed in videos/<slug>/video.json.
 *
 *   node scripts/render.mjs hello                # one video
 *   node scripts/render.mjs hello --quality draft
 *   node scripts/render.mjs --all --quality delivery
 *   node scripts/render.mjs --all --json
 *
 * Every render produces three files in out/:
 *   <slug>.mp4          the video
 *   <slug>.json         probe summary (duration, size, streams, engine, quality)
 *   <slug>.contact.png  8-frame contact sheet, the only way to *see* the result
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VIDEOS_DIR = path.join(ROOT, "videos");

// Binaries installed by scripts/bootstrap.sh (pod) win over the system ones.
for (const p of [path.join(ROOT, ".bin"), path.join(ROOT, ".bin", "node", "bin")]) {
  if (existsSync(p)) process.env.PATH = `${p}${path.delimiter}${process.env.PATH}`;
}

// On Windows the inherited %TEMP% is not always writable by the renderer's ffmpeg; keep scratch
// files inside the repo there. On Linux the system temp dir is fine (and faster than a volume).
if (process.platform === "win32") {
  const tmp = path.join(ROOT, "tmp");
  mkdirSync(tmp, { recursive: true });
  process.env.TEMP = tmp;
  process.env.TMP = tmp;
}

const QUALITIES = new Set(["draft", "looks", "delivery"]);

function parseArgs(argv) {
  const opts = {
    slugs: [],
    all: false,
    quality: null,
    outDir: path.join(ROOT, "out"),
    json: false,
    dryRun: false,
    sheet: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") opts.all = true;
    else if (a === "--list") opts.list = true;
    else if (a === "--quality") opts.quality = argv[++i];
    else if (a === "--out") opts.outDir = path.resolve(argv[++i]);
    else if (a === "--json") opts.json = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--no-sheet") opts.sheet = false;
    else if (a === "--help" || a === "-h") {
      console.log(readFileSync(new URL(import.meta.url)).toString().split("*/")[0].replace(/^#!.*\n/, ""));
      process.exit(0);
    } else if (a.startsWith("-")) throw new Error(`Unknown flag: ${a}`);
    else opts.slugs.push(a);
  }
  if (opts.quality && !QUALITIES.has(opts.quality))
    throw new Error(`--quality must be one of ${[...QUALITIES].join(", ")}`);
  return opts;
}

/** Path to the JS entry of an installed CLI package, so we never depend on npx or a shell. */
function toolBin(pkgName) {
  const pkgJson = path.join(ROOT, "node_modules", pkgName, "package.json");
  if (!existsSync(pkgJson)) return null;
  const pkg = JSON.parse(readFileSync(pkgJson, "utf8"));
  const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin && pkg.bin[Object.keys(pkg.bin)[0]];
  if (!bin) return null;
  const file = path.resolve(path.dirname(pkgJson), bin);
  return existsSync(file) ? file : null;
}

function runTool(pkgName, args, cwd) {
  const bin = toolBin(pkgName);
  if (!bin) throw new Error(`${pkgName} is not installed. Run: npm ci`);
  const res = spawnSync(process.execPath, [bin, ...args], { cwd, stdio: "inherit", env: process.env });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`${pkgName} exited with code ${res.status}`);
}

function ffprobe(file) {
  const res = spawnSync(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file],
    { encoding: "utf8" },
  );
  if (res.status !== 0) throw new Error(`ffprobe failed: ${res.stderr || "unknown error"}`);
  const j = JSON.parse(res.stdout);
  const v = j.streams.find((s) => s.codec_type === "video");
  const a = j.streams.find((s) => s.codec_type === "audio");
  return {
    duration: Number(Number(j.format.duration).toFixed(2)),
    width: v?.width ?? null,
    height: v?.height ?? null,
    fps: v?.r_frame_rate ?? null,
    videoCodec: v?.codec_name ?? null,
    audioCodec: a?.codec_name ?? null,
    sizeMB: Number((Number(j.format.size) / 1e6).toFixed(2)),
  };
}

function contactSheet(file, outPng, duration) {
  const cols = 4;
  const rows = 2;
  const step = Math.max(0.5, duration / (cols * rows));
  const vf = `fps=1/${step.toFixed(3)},scale=480:-1,tile=${cols}x${rows}:padding=8:margin=8`;
  const res = spawnSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-i", file, "-vf", vf, "-frames:v", "1", outPng],
    { encoding: "utf8" },
  );
  if (res.status !== 0) {
    console.warn(`  ! contact sheet failed: ${(res.stderr || "").trim().split("\n")[0]}`);
    return null;
  }
  return outPng;
}

async function listProjects() {
  const entries = await readdir(VIDEOS_DIR, { withFileTypes: true });
  const projects = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = path.join(VIDEOS_DIR, e.name);
    const manifestPath = path.join(dir, "video.json");
    if (!existsSync(manifestPath)) continue;
    projects.push({ slug: e.name, dir, manifestPath });
  }
  return projects.sort((a, b) => a.slug.localeCompare(b.slug));
}

async function renderOne(project, opts) {
  const manifest = JSON.parse(await readFile(project.manifestPath, "utf8"));
  const slug = manifest.slug || project.slug;
  const quality = opts.quality ?? manifest.quality ?? "looks";
  const engine = manifest.engine;
  const outFile = path.join(opts.outDir, `${slug}.mp4`);

  if (!engine) throw new Error(`${slug}: video.json has no "engine"`);

  const started = Date.now();
  console.log(`\n▶ ${slug} — ${engine}, quality=${quality}`);

  if (opts.dryRun) {
    console.log(`  would write ${outFile}`);
    return { slug, ok: true, dryRun: true };
  }

  await mkdir(opts.outDir, { recursive: true });

  // Cloud images ship a Chromium at /usr/bin/chromium; bootstrap exports its path so nothing has
  // to download a second browser. HyperFrames reads the variable itself, Remotion needs the flag.
  const sharedBrowser = process.env.HYPERFRAMES_BROWSER_PATH;
  const hasSharedBrowser = sharedBrowser && existsSync(sharedBrowser);

  if (engine === "hyperframes") {
    runTool("hyperframes", ["render", "--quality", quality, "--output", outFile], project.dir);
  } else if (engine === "remotion") {
    const entry = manifest.entry || "src/index.ts";
    const composition = manifest.composition;
    if (!composition) throw new Error(`${slug}: remotion project needs "composition" in video.json`);
    const args = ["render", entry, composition, outFile, `--concurrency=${manifest.concurrency ?? 2}`];
    if (hasSharedBrowser) args.push(`--browser-executable=${sharedBrowser}`);
    if (quality === "draft") args.push("--scale=0.5");
    else if (quality === "delivery") args.push("--codec=h264", "--crf=16");
    runTool("@remotion/cli", args, project.dir);
  } else {
    throw new Error(`${slug}: unknown engine "${engine}" (expected hyperframes | remotion)`);
  }

  if (!existsSync(outFile)) throw new Error(`${slug}: render reported success but ${outFile} is missing`);

  const probe = ffprobe(outFile);
  const sheet = opts.sheet
    ? contactSheet(outFile, path.join(opts.outDir, `${slug}.contact.png`), probe.duration)
    : null;

  const drift =
    typeof manifest.duration === "number"
      ? Number((probe.duration - manifest.duration).toFixed(2))
      : null;
  if (drift !== null && Math.abs(drift) > 0.4) {
    console.warn(`  ! duration drift: video.json says ${manifest.duration}s, file is ${probe.duration}s`);
  }

  const summary = {
    slug,
    title: manifest.title ?? slug,
    engine,
    quality,
    file: path.relative(ROOT, outFile).replaceAll("\\", "/"),
    contactSheet: sheet ? path.relative(ROOT, sheet).replaceAll("\\", "/") : null,
    ...probe,
    expectedDuration: manifest.duration ?? null,
    durationDrift: drift,
    renderSeconds: Number(((Date.now() - started) / 1000).toFixed(1)),
    renderedAt: new Date().toISOString(),
  };
  await writeFile(path.join(opts.outDir, `${slug}.json`), JSON.stringify(summary, null, 2));

  console.log(
    `  ✓ ${summary.file} — ${probe.width}x${probe.height}, ${probe.duration}s, ${probe.sizeMB} MB, ` +
      `${summary.renderSeconds}s render`,
  );
  if (sheet) console.log(`  ✓ ${summary.contactSheet} — look at this before calling it done`);
  return { ...summary, ok: true };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const projects = await listProjects();

  if (projects.length === 0) {
    console.log("No videos with video.json found in videos/. Create one: node scripts/new-video.mjs my-slug");
    process.exit(0);
  }

  const selected = opts.all
    ? projects
    : opts.slugs.length
      ? projects.filter((p) => opts.slugs.includes(p.slug))
      : null;

  if (!selected) {
    console.log("Pick a video (or --all):\n");
    for (const p of projects) {
      const m = JSON.parse(readFileSync(p.manifestPath, "utf8"));
      console.log(`  ${p.slug.padEnd(24)} ${String(m.engine ?? "?").padEnd(12)} ${m.title ?? ""}`);
    }
    process.exit(0);
  }

  const missing = opts.slugs.filter((s) => !projects.some((p) => p.slug === s));
  if (missing.length) {
    console.error(`Unknown video(s): ${missing.join(", ")}. See: node scripts/render.mjs`);
    process.exit(1);
  }

  const results = [];
  for (const project of selected) {
    try {
      results.push(await renderOne(project, opts));
    } catch (err) {
      console.error(`  ✗ ${project.slug}: ${err.message}`);
      results.push({ slug: project.slug, ok: false, error: err.message });
    }
  }

  const failed = results.filter((r) => !r.ok);
  if (!opts.json) {
    console.log(`\n${results.length - failed.length}/${results.length} rendered → ${path.relative(ROOT, opts.outDir)}`);
  } else {
    console.log(JSON.stringify(results, null, 2));
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
