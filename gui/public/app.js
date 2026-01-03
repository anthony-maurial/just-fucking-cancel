// State
let sessionId = null;
let messageCount = 0;

// Elements
const screens = {
  upload: document.getElementById('screen-upload'),
  chat: document.getElementById('screen-chat'),
  report: document.getElementById('screen-report')
};

const dropZone = document.getElementById('drop-zone');
const csvInput = document.getElementById('csv-input');
const messages = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const btnSend = document.getElementById('btn-send');
const btnReport = document.getElementById('btn-report');
const quickActions = document.getElementById('quick-actions');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const loadingTime = document.getElementById('loading-time');
const errorToast = document.getElementById('error-toast');
const reportFrame = document.getElementById('report-frame');

// Screen management
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  screens[name].classList.add('active');

  // Focus input when showing chat
  if (name === 'chat') {
    setTimeout(() => userInput.focus(), 100);
  }
}

// Loading state
let loadingTimer = null;

function showLoading(text = 'Thinking...') {
  loadingText.textContent = text;
  loadingTime.textContent = '0s';
  loading.classList.remove('hidden');

  let seconds = 0;
  loadingTimer = setInterval(() => {
    seconds++;
    loadingTime.textContent = `${seconds}s`;
  }, 1000);
}

function hideLoading() {
  loading.classList.add('hidden');
  if (loadingTimer) {
    clearInterval(loadingTimer);
    loadingTimer = null;
  }
}

// Error handling
function showError(message, duration = 5000) {
  errorToast.textContent = message;
  errorToast.classList.remove('hidden');
  setTimeout(() => errorToast.classList.add('hidden'), duration);
}

// Messages
function addMessage(text, role = 'assistant') {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  const content = document.createElement('div');
  content.className = 'message-content';
  content.textContent = text;
  div.appendChild(content);

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;

  messageCount++;

  // Enable report button after a few exchanges
  if (messageCount >= 3) {
    btnReport.disabled = false;
  }
}

// API calls
async function api(endpoint, body = {}) {
  const res = await fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (!res.ok) {
    const errorMsg = data.action ? `${data.error}\n\n${data.action}` : data.error;
    throw new Error(errorMsg || 'Request failed');
  }

  return data;
}

// Upload CSV
async function uploadCSV(file) {
  if (!file) {
    return;
  }

  if (!file.name.toLowerCase().endsWith('.csv')) {
    showError('Please upload a CSV file');
    return;
  }

  showLoading('Analyzing transactions...');

  try {
    const formData = new FormData();
    formData.append('csv', file);

    const res = await fetch('/api/start', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data.action ? `${data.error}\n\n${data.action}` : data.error;
      throw new Error(errorMsg || 'Upload failed');
    }

    sessionId = data.sessionId;
    showScreen('chat');
    addMessage(data.message);
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
  }
}

// Send message
async function sendMessage(text) {
  if (!text.trim() || !sessionId) return;

  addMessage(text, 'user');
  userInput.value = '';
  showLoading();

  try {
    const data = await api('chat', { sessionId, message: text });
    addMessage(data.message);
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
  }
}

// Generate report
async function generateReport() {
  showLoading('Generating report...');

  try {
    const data = await api('report', { sessionId });

    // Write HTML to iframe
    reportFrame.srcdoc = data.html;
    showScreen('report');
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
  }
}

// Download report
function downloadReport() {
  const html = reportFrame.srcdoc;
  if (!html) {
    showError('No report to download');
    return;
  }

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `subscription-audit-${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

// ==================== Event Listeners ====================

// Drop zone - click to upload
dropZone.addEventListener('click', () => csvInput.click());

csvInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    uploadCSV(e.target.files[0]);
  }
});

// Drop zone - drag and drop
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) {
    uploadCSV(e.dataTransfer.files[0]);
  }
});

// Chat - send button
btnSend.addEventListener('click', () => sendMessage(userInput.value));

// Chat - enter key
userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(userInput.value);
  }
});

// Chat - quick actions
quickActions.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const action = btn.dataset.action;
  if (action) {
    const responses = {
      keep: 'Keep it',
      cancel: 'Cancel it',
      investigate: "I'm not sure, let me think about it"
    };
    sendMessage(responses[action]);
  }
});

// Report - generate
btnReport.addEventListener('click', generateReport);

// Report - back to chat
document.getElementById('btn-back').addEventListener('click', () => showScreen('chat'));

// Report - download
document.getElementById('btn-download').addEventListener('click', downloadReport);

// Cleanup on close
window.addEventListener('beforeunload', () => {
  if (sessionId) {
    // Use sendBeacon for reliable cleanup on page close
    navigator.sendBeacon('/api/end', JSON.stringify({ sessionId }));
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Escape to go back from report
  if (e.key === 'Escape' && screens.report.classList.contains('active')) {
    showScreen('chat');
  }

  // Cmd/Ctrl + Enter to generate report
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && screens.chat.classList.contains('active')) {
    if (!btnReport.disabled) {
      generateReport();
    }
  }
});

// Log startup
console.log('Just Fucking Cancel - GUI loaded');
