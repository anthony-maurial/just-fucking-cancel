import { mkdir, cp, rm, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_SOURCE = path.join(__dirname, '../skill-files/.claude');

// Active sessions (in-memory, single process)
const sessions = new Map();

export class Session {
  constructor(id, dir) {
    this.id = id;
    this.dir = dir;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.state = 'init'; // init, analyzing, reviewing, done
    this.csvPath = null;
  }

  touch() {
    this.lastActivity = Date.now();
  }
}

export async function createSession() {
  const id = crypto.randomUUID().slice(0, 8);
  const dir = path.join(os.tmpdir(), `jfc-${id}`);

  // Create session directory
  await mkdir(dir, { recursive: true });

  // Copy skill files to session directory
  if (existsSync(SKILL_SOURCE)) {
    const destSkillDir = path.join(dir, '.claude');
    await cp(SKILL_SOURCE, destSkillDir, { recursive: true });
    console.log(`  [Session ${id}] Copied skill files`);
  } else {
    console.warn(`  [Session ${id}] Warning: skill files not found at ${SKILL_SOURCE}`);
  }

  const session = new Session(id, dir);
  sessions.set(id, session);

  console.log(`  [Session ${id}] Created at ${dir}`);
  return session;
}

export function getSession(id) {
  return sessions.get(id);
}

export async function saveCSV(session, buffer, filename) {
  const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const csvPath = path.join(session.dir, safeName);
  await writeFile(csvPath, buffer);
  session.csvPath = csvPath;
  session.touch();
  console.log(`  [Session ${session.id}] Saved CSV: ${safeName}`);
  return csvPath;
}

export async function readCSV(session) {
  if (!session.csvPath) return null;
  return readFile(session.csvPath, 'utf-8');
}

export async function destroySession(id) {
  const session = sessions.get(id);
  if (!session) return;

  try {
    await rm(session.dir, { recursive: true, force: true });
    console.log(`  [Session ${id}] Cleaned up`);
  } catch (e) {
    console.error(`  [Session ${id}] Cleanup failed:`, e.message);
  }

  sessions.delete(id);
}

// Cleanup old sessions (call periodically or on shutdown)
export async function cleanupStaleSessions(maxAgeMs = 30 * 60 * 1000) {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActivity > maxAgeMs) {
      await destroySession(id);
    }
  }
}

// Get all active sessions (for debugging)
export function listSessions() {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    state: s.state,
    age: Math.round((Date.now() - s.createdAt) / 1000) + 's'
  }));
}
