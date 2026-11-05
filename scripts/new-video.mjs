#!/usr/bin/env node
/**
 * Create a new video from a template.
 *
 *   node scripts/new-video.mjs my-slug --engine hyperframes --title "My Film"
 *   node scripts/new-video.mjs my-slug --engine remotion
 *
 * Copies templates/<engine>/ to videos/<slug>/, fills video.json, replaces {{TITLE}} / {{SLUG}}
 * tokens in text files. Refuses to overwrite an existing video.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cp, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATES = path.join(ROOT, "templates");
const VIDEOS = path.join(ROOT, "videos");
const TEXT_EXT = new Set([".html", ".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".md"]);

function usage(msg) {
  if (msg) console.error(`✗ ${msg}\n`);
  console.log(`Usage: node scripts/new-video.mjs <slug> [--engine hyperframes|remotion] [--title "..."]`);
  process.exit(msg ? 1 : 0);
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === "--help") usage();

  const slug = argv[0];
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) {
    usage("slug must be lowercase letters, digits and dashes (2-41 chars)");
  }

  let engine = "hyperframes";
  let title = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--engine") engine = argv[++i];
    else if (argv[i] === "--title") title = argv[++i];
    else usage(`unknown flag ${argv[i]}`);
  }

  if (!["hyperframes", "remotion"].includes(engine)) usage(`unknown engine ${engine}`);

  const templateDir = path.join(TEMPLATES, engine);
  const targetDir = path.join(VIDEOS, slug);
  if (!existsSync(templateDir)) usage(`template missing: ${path.relative(ROOT, templateDir)}`);
  if (existsSync(targetDir)) usage(`videos/${slug} already exists`);

  await cp(templateDir, targetDir, { recursive: true });

  const manifestPath = path.join(targetDir, "video.json");
  if (!existsSync(manifestPath)) usage(`template has no video.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.slug = slug;
  manifest.title = title;
  manifest.engine = engine;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  async function replaceInDir(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".hyperframes") continue;
        await replaceInDir(full);
      } else if (TEXT_EXT.has(path.extname(entry.name).toLowerCase())) {
        const before = await readFile(full, "utf8");
        const after = before.replaceAll("{{TITLE}}", title).replaceAll("{{SLUG}}", slug);
        if (after !== before) writeFileSync(full, after);
      }
    }
  }
  await replaceInDir(targetDir);

  console.log(`✓ videos/${slug} (${engine}, "${title}")`);
  console.log(`\nNext:`);
  console.log(`  cd videos/${slug}`);
  if (engine === "hyperframes") {
    console.log(`  # read .agents/skills/hyperframes/SKILL.md first, then edit index.html`);
    console.log(`  npx hyperframes check --json`);
    console.log(`  npx hyperframes snapshot --at 1,3,5`);
  } else {
    console.log(`  # edit src/Root.tsx and src/${path.basename("Hello")}.tsx`);
    console.log(`  npx tsc --noEmit`);
  }
  console.log(`  node scripts/render.mjs ${slug} --quality draft   # from repo root`);
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
