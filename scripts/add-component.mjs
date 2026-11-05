#!/usr/bin/env node
/**
 * Copy a ready-made animation component into a Remotion video.
 *
 *   node scripts/add-component.mjs --list                # all 81, grouped by category
 *   node scripts/add-component.mjs --list chart          # filter by category/name/description
 *   node scripts/add-component.mjs my-slug stat-counter  # copy into videos/my-slug/src/components/
 *
 * The components are MIT-licensed starting points (see .agents/skills/remotion-templates/NOTICE.md):
 * they have no props and hardcoded demo content, so the next step is always to rewrite the copy,
 * numbers and palette while keeping the frame math.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_DIR = path.join(ROOT, ".agents", "skills", "remotion-templates");
const CATALOG = JSON.parse(readFileSync(path.join(SKILL_DIR, "catalog.json"), "utf8"));
const VIDEOS = path.join(ROOT, "videos");

const argv = process.argv.slice(2);
if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
  console.log(readFileSync(new URL(import.meta.url), "utf8").split("*/")[0].replace(/^#!.*\n/, ""));
  process.exit(0);
}

const components = CATALOG.components;

function matches(entry, q) {
  const hay = `${entry.slug} ${entry.name} ${entry.category} ${entry.description}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

if (argv[0] === "--list") {
  const filter = argv[1];
  const list = filter ? components.filter((c) => matches(c, filter)) : components;
  if (list.length === 0) {
    console.error(`No component matches "${filter}"`);
    process.exit(1);
  }
  const byCategory = new Map();
  for (const c of list) {
    if (!byCategory.has(c.category)) byCategory.set(c.category, []);
    byCategory.get(c.category).push(c);
  }
  for (const [category, items] of byCategory) {
    console.log(`\n${category}`);
    for (const c of items) console.log(`  ${c.slug.padEnd(24)} ${c.description}`);
  }
  console.log(`\n${list.length} of ${components.length} components`);
  process.exit(0);
}

const [slug, ...queryParts] = argv;
const query = queryParts.join(" ").trim();
if (!query) {
  console.error("Usage: node scripts/add-component.mjs <video-slug> <component-name>");
  console.error("Try:   node scripts/add-component.mjs --list");
  process.exit(1);
}

const videoDir = path.join(VIDEOS, slug);
if (!existsSync(path.join(videoDir, "video.json"))) {
  console.error(`No video at videos/${slug} (missing video.json). Create one first:`);
  console.error(`  node scripts/new-video.mjs ${slug} --engine remotion --title "My Film"`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(path.join(videoDir, "video.json"), "utf8"));
if (manifest.engine !== "remotion") {
  console.error(`videos/${slug} runs on "${manifest.engine}", but these components are Remotion-only.`);
  console.error("HyperFrames equivalents live in .agents/skills/hyperframes-registry and via `npx hyperframes add`.");
  process.exit(1);
}

let chosen = components.find((c) => c.slug === query.toLowerCase());
if (!chosen) {
  const hits = components.filter((c) => matches(c, query));
  if (hits.length === 1) chosen = hits[0];
  else if (hits.length === 0) {
    console.error(`Nothing matched "${query}". Try: node scripts/add-component.mjs --list`);
    process.exit(1);
  } else {
    console.error(`"${query}" matched ${hits.length} components — be more specific:`);
    for (const h of hits) console.error(`  ${h.slug.padEnd(24)} ${h.description}`);
    process.exit(1);
  }
}

const destDir = path.join(videoDir, "src", "components");
mkdirSync(destDir, { recursive: true });
const dest = path.join(destDir, chosen.file);
await copyFile(path.join(SKILL_DIR, "components", chosen.file), dest);

const importName = chosen.slug
  .split("-")
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  .join("");

console.log(`✓ ${chosen.file} → videos/${slug}/src/components/`);
console.log(`  ${chosen.name} — ${chosen.description}`);
if (chosen.requiresAdaptation) {
  console.log(`\n  ! needs adaptation: ${chosen.requiresAdaptation}`);
  console.log(`    edit videos/${slug}/src/components/${chosen.file} before use`);
}
console.log(`\nNext:`);
console.log(`  1. Rewrite the demo copy, numbers and palette in the file (keep the frame math).`);
console.log(`  2. Import and layer it:`);
console.log(`       import ${importName} from "./components/${chosen.slug}";`);
console.log(`       <Sequence from={30} durationInFrames={90}><${importName} /></Sequence>`);
console.log(`  3. npx tsc --noEmit && npx remotion still src/index.ts <Composition> ../../out/still.png --frame=45`);
