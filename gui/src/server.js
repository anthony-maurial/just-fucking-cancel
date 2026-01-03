import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createSession,
  getSession,
  saveCSV,
  readCSV,
  destroySession,
  cleanupStaleSessions,
  listSessions
} from './session.js';
import { sendToClaudeInitial, sendToClaude } from './claude.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createServer() {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));

  // File upload config
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
  });

  // Request queue to prevent concurrent Claude calls per session
  const sessionQueues = new Map();

  async function queuedClaudeCall(sessionId, fn) {
    if (!sessionQueues.has(sessionId)) {
      sessionQueues.set(sessionId, Promise.resolve());
    }

    const queue = sessionQueues.get(sessionId);
    const result = queue.then(fn).catch((err) => {
      throw err;
    });
    sessionQueues.set(sessionId, result.catch(() => {})); // Don't let errors break the queue

    return result;
  }

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ ok: true, sessions: listSessions() });
  });

  // Start new session with CSV
  app.post('/api/start', upload.single('csv'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No CSV file uploaded' });
      }

      console.log(`  [API] Starting new session with ${req.file.originalname}`);

      // Create session and save CSV
      const session = await createSession();
      await saveCSV(session, req.file.buffer, req.file.originalname);

      // Read CSV content
      const csvContent = await readCSV(session);

      // Initial prompt - triggers the skill workflow
      const initialPrompt = `
I've uploaded my bank transactions CSV. Please analyze it for recurring subscription charges.

Here are my transactions:

${csvContent}

Find all recurring charges (subscriptions, memberships, SaaS) and ask me about them in batches of 5 at a time. For each one, I'll tell you if I want to Cancel, Keep, or Investigate further.

Be conversational and helpful. After identifying subscriptions, ask me about them one batch at a time.
`.trim();

      session.state = 'analyzing';

      const response = await sendToClaudeInitial(initialPrompt, session.dir);

      session.state = 'reviewing';
      session.touch();

      res.json({
        sessionId: session.id,
        message: response.text,
        cost: response.cost
      });
    } catch (error) {
      console.error('  [API] Start error:', error);
      handleClaudeError(error, res);
    }
  });

  // Continue conversation
  app.post('/api/chat', async (req, res) => {
    try {
      const { sessionId, message } = req.body;

      if (!sessionId || !message) {
        return res.status(400).json({ error: 'Missing sessionId or message' });
      }

      const session = getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found. Please start over.' });
      }

      console.log(`  [API] Chat in session ${sessionId}: "${message.slice(0, 50)}..."`);

      // Queue the request to prevent concurrent calls
      const response = await queuedClaudeCall(sessionId, async () => {
        return sendToClaude(message, session.dir);
      });

      session.touch();

      res.json({
        message: response.text,
        cost: response.cost
      });
    } catch (error) {
      console.error('  [API] Chat error:', error);
      handleClaudeError(error, res);
    }
  });

  // Generate final report
  app.post('/api/report', async (req, res) => {
    try {
      const { sessionId } = req.body;

      const session = getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      console.log(`  [API] Generating report for session ${sessionId}`);

      const prompt = `
Generate the final HTML audit report now. Use the template from the skill's assets/template.html file.

Include:
- All subscriptions we discussed, categorized as Cancelled, Investigate, or Keep
- The share card with total savings calculated (yearly and monthly)
- Proper formatting with the template's CSS and JavaScript

Output ONLY the complete HTML document - no markdown code blocks, no explanation, just the raw HTML starting with <!DOCTYPE html>.
`.trim();

      const response = await queuedClaudeCall(sessionId, async () => {
        return sendToClaude(prompt, session.dir);
      });

      session.state = 'done';
      session.touch();

      // Extract HTML from response (Claude might wrap it)
      let html = response.text;
      const htmlMatch = html.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
      if (htmlMatch) {
        html = htmlMatch[0];
      }

      res.json({
        html: html,
        cost: response.cost
      });
    } catch (error) {
      console.error('  [API] Report error:', error);
      handleClaudeError(error, res);
    }
  });

  // End session
  app.post('/api/end', async (req, res) => {
    const { sessionId } = req.body;
    if (sessionId) {
      console.log(`  [API] Ending session ${sessionId}`);
      await destroySession(sessionId);
    }
    res.json({ ok: true });
  });

  // Error handler helper
  function handleClaudeError(error, res) {
    const message = error.message || 'Unknown error';

    if (message === 'AUTH_REQUIRED') {
      res.status(401).json({
        error: 'Please log in to Claude Code first',
        action: 'Run `claude` in your terminal to authenticate'
      });
    } else if (message === 'RATE_LIMITED') {
      res.status(429).json({
        error: 'Claude is busy. Please wait a moment.',
        action: 'Try again in 30 seconds'
      });
    } else if (message === 'CLAUDE_NOT_FOUND') {
      res.status(500).json({
        error: 'Claude Code not installed',
        action: 'Run: npm install -g @anthropic-ai/claude-code'
      });
    } else {
      res.status(500).json({ error: message });
    }
  }

  // Cleanup stale sessions every 10 minutes
  setInterval(() => cleanupStaleSessions(), 10 * 60 * 1000);

  return app;
}
