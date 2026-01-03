#!/usr/bin/env node

/**
 * Sync skill files from the parent repo to the GUI package.
 * Run before publishing: npm run sync-skills
 *
 * This copies:
 *   ../.claude/skills/just-fucking-cancel/
 * To:
 *   ./skill-files/.claude/skills/just-fucking-cancel/
 */

import { cp, rm, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Source: parent repo's skill directory
const SOURCE_SKILL = path.resolve(__dirname, '../../.claude/skills/just-fucking-cancel');

// Destination: GUI package's bundled skills
const DEST_ROOT = path.resolve(__dirname, '../skill-files/.claude/skills');
const DEST_SKILL = path.join(DEST_ROOT, 'just-fucking-cancel');

async function sync() {
  console.log('\n  Syncing skill files...\n');

  // Check source exists
  if (!existsSync(SOURCE_SKILL)) {
    console.error(`  ❌ Source not found: ${SOURCE_SKILL}`);
    console.error('  Make sure you run this from within the cancel-stuff/gui directory.\n');
    process.exit(1);
  }

  // Clean destination
  if (existsSync(DEST_SKILL)) {
    await rm(DEST_SKILL, { recursive: true, force: true });
    console.log('  Cleaned existing skill files');
  }

  // Create destination directory
  await mkdir(DEST_ROOT, { recursive: true });

  // Copy skill files
  await cp(SOURCE_SKILL, DEST_SKILL, { recursive: true });

  // List what was copied
  const files = await listFiles(DEST_SKILL);
  console.log(`\n  ✓ Copied ${files.length} files to skill-files/\n`);
  files.forEach((f) => console.log(`    ${f}`));

  console.log('\n  Ready to publish!\n');
}

async function listFiles(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path.join(dir, entry.name), relPath)));
    } else {
      files.push(relPath);
    }
  }

  return files;
}

sync().catch((err) => {
  console.error('  ❌ Sync failed:', err.message);
  process.exit(1);
});
