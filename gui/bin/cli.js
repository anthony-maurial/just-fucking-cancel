#!/usr/bin/env node

import { spawn } from 'child_process';
import { createServer } from '../src/server.js';
import open from 'open';

const PORT = process.env.PORT || 3847;

// Check if Claude Code is installed
async function checkClaude() {
  return new Promise((resolve) => {
    const proc = spawn('claude', ['--version'], {
      stdio: 'pipe',
      shell: process.platform === 'win32' // Windows needs shell
    });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

async function main() {
  console.log('\n  \x1b[1m\x1b[33m🔥 Just Fucking Cancel\x1b[0m\n');

  // Check for Claude Code
  const hasClaude = await checkClaude();
  if (!hasClaude) {
    console.error('  \x1b[31m❌ Claude Code not found.\x1b[0m\n');
    console.error('  Install it first:');
    console.error('    \x1b[36mnpm install -g @anthropic-ai/claude-code\x1b[0m\n');
    console.error('  Then log in:');
    console.error('    \x1b[36mclaude\x1b[0m\n');
    process.exit(1);
  }

  // Start server
  const server = createServer();

  server.listen(PORT, () => {
    console.log(`  \x1b[32mLocal:\x1b[0m   http://localhost:${PORT}\n`);
    console.log('  Drop your bank CSV to get started.\n');
    console.log('  Press \x1b[2mCtrl+C\x1b[0m to quit.\n');

    open(`http://localhost:${PORT}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n  Shutting down...\n');
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('  \x1b[31mError:\x1b[0m', err.message);
  process.exit(1);
});
