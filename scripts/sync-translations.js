#!/usr/bin/env node

/**
 * Translation Sync Script
 *
 * Scans source code for translate() and <Translate> usage,
 * compares with i18n/en/code.json, and reports missing translations.
 *
 * Usage: node scripts/sync-translations.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const SRC_DIRS = [
  path.join(ROOT, 'src'),
];

const TRANSLATION_FILE = path.join(ROOT, 'i18n', 'en', 'code.json');

// Patterns to extract translation IDs from source code
const TRANSLATE_FUNC_RE = /translate\(\s*\{\s*id:\s*['"]([^'"]+)['"]/g;
const TRANSLATE_COMP_RE = /<Translate\s+id="([^"]+)"/g;

function findFiles(dir, ext) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(full, ext));
    } else if (entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

function extractIds(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ids = new Set();

  let match;
  const funcRe = new RegExp(TRANSLATE_FUNC_RE.source, 'g');
  while ((match = funcRe.exec(content)) !== null) {
    ids.add(match[1]);
  }

  const compRe = new RegExp(TRANSLATE_COMP_RE.source, 'g');
  while ((match = compRe.exec(content)) !== null) {
    ids.add(match[1]);
  }

  return ids;
}

function main() {
  // 1. Collect all translation IDs from source
  const allIds = new Set();
  const idSources = {};

  for (const dir of SRC_DIRS) {
    const jsxFiles = [...findFiles(dir, '.jsx'), ...findFiles(dir, '.tsx'), ...findFiles(dir, '.js')];
    for (const file of jsxFiles) {
      const ids = extractIds(file);
      const relPath = path.relative(ROOT, file);
      for (const id of ids) {
        allIds.add(id);
        if (!idSources[id]) idSources[id] = [];
        idSources[id].push(relPath);
      }
    }
  }

  console.log(`Found ${allIds.size} translation IDs in source code.\n`);

  // 2. Load existing translations
  let translations = {};
  if (fs.existsSync(TRANSLATION_FILE)) {
    translations = JSON.parse(fs.readFileSync(TRANSLATION_FILE, 'utf-8'));
  } else {
    console.log(`Translation file not found: ${TRANSLATION_FILE}`);
    console.log('Run: npm run write-translations -- --locale en\n');
  }

  const existingIds = new Set(Object.keys(translations));

  // 3. Find missing translations (in code but not in translation file)
  const missing = [...allIds].filter(id => !existingIds.has(id)).sort();

  // 4. Find unused translations (in translation file but not in code)
  // Only check custom IDs, not theme.* ones
  const unused = [...existingIds]
    .filter(id => !id.startsWith('theme.') && !allIds.has(id))
    .sort();

  // 5. Report
  if (missing.length > 0) {
    console.log(`Missing translations (${missing.length}):`);
    for (const id of missing) {
      console.log(`  - ${id}  (used in: ${idSources[id].join(', ')})`);
    }
    console.log();
  } else {
    console.log('All translation IDs have entries in code.json.\n');
  }

  if (unused.length > 0) {
    console.log(`Potentially unused translations (${unused.length}):`);
    for (const id of unused) {
      console.log(`  - ${id}`);
    }
    console.log();
  }

  // Summary
  console.log('Summary:');
  console.log(`  Source IDs:   ${allIds.size}`);
  console.log(`  Translated:   ${existingIds.size} (including theme strings)`);
  console.log(`  Missing:      ${missing.length}`);
  console.log(`  Unused:       ${unused.length}`);

  if (missing.length > 0) {
    process.exit(1);
  }
}

main();
