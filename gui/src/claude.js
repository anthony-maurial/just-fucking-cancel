import { spawn } from 'child_process';

const TIMEOUT_MS = 120_000; // 2 minutes

export async function sendToClaudeInitial(prompt, workingDir) {
  return runClaude(prompt, workingDir, { continueSession: false });
}

export async function sendToClaude(prompt, workingDir) {
  return runClaude(prompt, workingDir, { continueSession: true });
}

function runClaude(prompt, workingDir, options = {}) {
  const { continueSession = false } = options;

  return new Promise((resolve, reject) => {
    const args = ['-p', prompt, '--output-format', 'json'];

    if (continueSession) {
      args.push('-c');
    }

    console.log(`  [Claude] Running in ${workingDir}`);
    console.log(`  [Claude] Continue: ${continueSession}`);
    console.log(`  [Claude] Prompt length: ${prompt.length} chars`);

    const proc = spawn('claude', args, {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        // Ensure Claude uses the session directory
        CLAUDE_PROJECT_DIR: workingDir
      }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      // Log stderr in real-time for debugging
      process.stderr.write(data);
    });

    // Timeout handler
    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error('Claude timed out after 2 minutes'));
    }, TIMEOUT_MS);

    proc.on('close', (code) => {
      clearTimeout(timeout);

      console.log(`  [Claude] Exited with code ${code}`);

      if (code !== 0) {
        // Check for common errors
        if (stderr.includes('not authenticated') || stderr.includes('log in')) {
          reject(new Error('AUTH_REQUIRED'));
        } else if (stderr.includes('rate limit')) {
          reject(new Error('RATE_LIMITED'));
        } else {
          reject(new Error(`Claude exited with code ${code}: ${stderr}`));
        }
        return;
      }

      try {
        // Claude outputs JSON with result field
        const response = JSON.parse(stdout);
        console.log(`  [Claude] Response length: ${(response.result || '').length} chars`);
        resolve({
          text: response.result || response.text || stdout,
          cost: response.cost_usd,
          sessionId: response.session_id
        });
      } catch (e) {
        // Fallback to raw text if JSON parse fails
        console.warn('  [Claude] JSON parse failed, using raw output');
        resolve({ text: stdout });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      if (err.code === 'ENOENT') {
        reject(new Error('CLAUDE_NOT_FOUND'));
      } else {
        reject(err);
      }
    });
  });
}

// Parse Claude's response for structured data (like subscription lists)
export function parseSubscriptions(text) {
  // Claude might return structured data in various formats
  // This is a simple extractor - enhance as needed
  const subscriptions = [];

  // Look for patterns like "- Netflix ($15.99/mo)"
  const pattern = /[-•]\s*([^($]+)\s*\(\$?([\d.]+)/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    subscriptions.push({
      name: match[1].trim(),
      amount: parseFloat(match[2])
    });
  }

  return subscriptions;
}
