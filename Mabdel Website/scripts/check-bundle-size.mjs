#!/usr/bin/env node
// Fails the build if any JS chunk exceeds a size budget, uncompressed.
// This exists because a real regression shipped once: the entire i18n system
// (all 12 languages) was bundled into one 1.47MB chunk loaded on every page.
// Known-large, justified chunks (big vendor libraries, one-per-language i18n
// chunks that only load on demand) get a separate, higher budget.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST_ASSETS = join(process.cwd(), 'dist', 'assets');
const DEFAULT_BUDGET_BYTES = 300 * 1024; // 300 KB uncompressed
const LARGE_CHUNK_BUDGET_BYTES = 600 * 1024; // 600 KB - vendor bundles, per-language i18n chunks

const LARGE_CHUNK_PREFIXES = [
  'vendor-', // vendor-react, vendor-telnyx, vendor-libs, etc.
  'ar-SA-', 'bn-BD-', 'en-US-', 'es-ES-', 'fr-FR-', 'hi-IN-', 'ja-JP-',
  'pt-BR-', 'ru-RU-', 'tr-TR-', 'ur-PK-', 'zh-CN-', // one per language, loaded on demand only
];

let files;
try {
  files = readdirSync(DIST_ASSETS).filter((f) => f.endsWith('.js'));
} catch {
  console.error(`Could not read ${DIST_ASSETS} - run "npm run build" first.`);
  process.exit(1);
}

const violations = [];
for (const file of files) {
  const size = statSync(join(DIST_ASSETS, file)).size;
  const isLargeChunk = LARGE_CHUNK_PREFIXES.some((p) => file.startsWith(p));
  const budget = isLargeChunk ? LARGE_CHUNK_BUDGET_BYTES : DEFAULT_BUDGET_BYTES;
  if (size > budget) {
    violations.push({ file, size, budget });
  }
}

if (violations.length) {
  console.error('Bundle size budget exceeded:\n');
  for (const v of violations) {
    console.error(`  ${v.file}: ${(v.size / 1024).toFixed(0)} KB (budget: ${(v.budget / 1024).toFixed(0)} KB)`);
  }
  console.error('\nIf this growth is deliberate, raise the budget in scripts/check-bundle-size.mjs with a comment explaining why.');
  process.exit(1);
}

console.log(`Bundle size check passed (${files.length} JS chunks, largest under budget).`);
