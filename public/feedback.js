// feedback.js - updated to use Formspree endpoint (no-email flow)
// - Form handling (POST to Formspree or fallback to localStorage queue)
// - Voice commands with continuous listening toggle
// - Combined voice parsing: "enter name john and message I love your app"
// - TTS confirmations and UI status updates
// - Redirects back to index.html after successful send or local save

const DOM = {
  form: null,
  name: null,
  message: null,
  status: null,
  clearBtn: null,
  sendBtn: null,
  listenBtn: null
};

function speak(text) {
  try {
    if (!window.speechSynthesis || !text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) {
    console.warn('TTS failed', e);
  }
}

// parse combined voice commands for name & message (email removed)
function parseCombinedVoiceCommand(text) {
  const res = {};
  if (!text) return res;

  let t = text.trim();
  t = t.replace(/^(please|kindly)\s+/i, '');

  // split by ' and ' or comma
  const parts = t.split(/\s+and\s+|,\s*/i).map(p => p.trim()).filter(Boolean);

  for (const p of parts) {
    let m = p.match(/^(?:name|my name is|name is|set name|enter name)\s*(?:is|:)?\s*(.+)$/i);
    if (m) {
      res.name = m[1].trim();
      continue;
    }
    m = p.match(/^(?:message|msg|my message is|message is|enter message|set message)\s*(?:is|:)?\s*(.+)$/i);
    if (m) {
      res.message = m[1].trim();
      continue;
    }

    // detect inside the part
    const nameG = p.match(/name\s*(?:is|:)?\s*([a-z0-9 .'\-]+)/i);
    if (nameG && !res.name) res.name = nameG[1].trim();

    const msgG = p.match(/message\s*(?:is|:)?\s*(.+)$/i);
    if (msgG && !res.message) res.message = msgG[1].trim();
  }

  // Fallback global
  if (!res.name) {
    const g = t.match(/name\s*(?:is|:)?\s*([a-z0-9 .'\-]+)/i);
    if (g) res.name = g[1].trim();
  }
  if (!res.message) {
    const g = t.match(/message\s*(?:is|:)?\s*(.+)$/i);
    if (g) res.message = g[1].trim();
  }

  return res;
}

document.addEventListener('DOMContentLoaded', () => {
  DOM.form = document.getElementById('feedbackForm');
  DOM.name = document.getElementById('fb-name');
  DOM.message = document.getElementById('fb-message');
  DOM.status = document.getElementById('fb-status');
  DOM.clearBtn = document.getElementById('fb-clear');
  DOM.sendBtn = document.getElementById('fb-send');
  DOM.listenBtn = document.getElementById('feedback-listen');

  if (!DOM.form) return;

  // helper to get endpoint (Formspree)
  function getEndpoint() {
    return (DOM.form.dataset && DOM.form.dataset.endpoint) ? DOM.form.dataset.endpoint : 'https://formspree.io/f/xnnldeka';
  }

  // Clear button handler (immediate UI feedback + focus)
  if (DOM.clearBtn) {
    DOM.clearBtn.addEventListener('click', () => {
      DOM.form.reset();
      DOM.status.textContent = 'Form cleared';
      speak('Form cleared');
      setTimeout(() => { if (DOM.status) DOM.status.textContent = ''; }, 1600);
      if (DOM.name) DOM.name.focus();
    });
  }

  // helper: save to local queue
  function saveToLocal(payload) {
    try {
      const key = 'neun_feedback_queue';
      const queue = JSON.parse(localStorage.getItem(key) || '[]');
      queue.push(payload);
      localStorage.setItem(key, JSON.stringify(queue));
      return true;
    } catch (e) {
      console.error('saveToLocal error', e);
      return false;
    }
  }

  // Submit handler: posts to Formspree or saves locally, then redirect back
  DOM.form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    DOM.status.textContent = '';

    const name = (DOM.name.value || '').trim();
    const message = (DOM.message.value || '').trim();

    if (!message) {
      DOM.status.textContent = 'Please enter a message.';
      speak('Please enter a message');
      return;
    }

    const payload = {
      name: name || 'Anonymous',
      message,
      ts: new Date().toISOString()
    };

    DOM.status.textContent = 'Sending...';
    speak('Sending feedback');

    const endpoint = getEndpoint();

    // Try Formspree JSON API
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ name: payload.name, message: payload.message })
      });

      // Try parse JSON but guard
      let data = null;
      try { data = await resp.json(); } catch (e) { data = null; }

      if (resp.ok) {
        DOM.status.textContent = 'Thanks — your feedback was sent.';
        speak('Thanks, your feedback was sent');
        DOM.form.reset();
        // redirect after a short delay
        setTimeout(() => { window.location.href = 'index.html'; }, 900);
        return;
      } else {
        console.warn('Formspree returned non-ok', resp.status, data);
        // continue to fallback
      }
    } catch (e) {
      console.warn('Formspree POST failed', e);
    }

    // Fallback: save locally then redirect
    const ok = saveToLocal(payload);
    if (ok) {
      DOM.status.textContent = 'Saved locally (no server). Will retry when available.';
      speak('Saved locally. I will retry when the server is available');
      DOM.form.reset();
      setTimeout(() => { window.location.href = 'index.html'; }, 900);
    } else {
      DOM.status.textContent = 'Failed to save feedback locally.';
      console.error('feedback save error');
      speak('Failed to save feedback locally');
    }
  });

  // background retry attempt (silent) — posts queued items to Formspree
  (async function tryFlushQueue(){
    try {
      const key = 'neun_feedback_queue';
      const q = JSON.parse(localStorage.getItem(key) || '[]');
      if (!q.length) return;
      const endpoint = getEndpoint();
      for (let i = 0; i < q.length; i++) {
        try {
          const item = q[i];
          const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ name: item.name, message: item.message })
          });
          if (resp.ok) {
            q.splice(i, 1);
            i--;
          } else {
            // stop trying further to avoid rate limits/errors
            break;
          }
        } catch (er) {
          break;
        }
      }
      localStorage.setItem(key, JSON.stringify(q));
    } catch (e) { /* ignore */ }
  })();

  // Initialize continuous voice (toggleable)
  initFeedbackVoice();
});

function initFeedbackVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (DOM.listenBtn) DOM.listenBtn.style.display = 'none';
    return;
  }

  const rec = new SpeechRecognition();
  rec.lang = 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.continuous = true; // continuous listening

  let listening = false;

  function updateUI() {
    if (!DOM.listenBtn) return;
    DOM.listenBtn.setAttribute('aria-pressed', listening ? 'true' : 'false');
    DOM.listenBtn.classList.toggle('listening', listening);
    DOM.listenBtn.textContent = listening ? '🎙️ Listening...' : '🎙️ Listen';
  }

  // Toggle continuous listening on click
  DOM.listenBtn.addEventListener('click', () => {
    try {
      if (!listening) rec.start();
      else rec.stop();
    } catch (e) {
      console.warn('rec toggle error', e);
    }
  });

  rec.onstart = () => {
    listening = true;
    updateUI();
    speak('Listening');
  };

  rec.onend = () => {
    // If listening flag is true, restart to maintain continuous mode.
    // If user clicked stop (listening == false), then don't restart.
    if (listening) {
      try { rec.start(); } catch (e) { console.warn('restart failed', e); }
    } else {
      updateUI();
      speak('Stopped listening');
    }
  };

  rec.onerror = (err) => {
    console.warn('feedback voice error', err);
    if (DOM.status) DOM.status.textContent = 'Voice error';
    listening = false;
    updateUI();
  };

  rec.onresult = (e) => {
    const text = (e.results[e.resultIndex][0].transcript || '').trim();
    const lower = text.toLowerCase();
    if (!text) return;

    if (DOM.status) DOM.status.textContent = `Heard: "${text}"`;
    speak(`Heard: ${text}`);

    // Commands: navigation
    if (lower.includes('sudoku') || lower.includes('go back') || lower.includes('back')) {
      speak('Going back to Sudoku');
      window.location.href = 'index.html';
      return;
    }

    // Submit
    if (lower.includes('send') || lower.includes('submit') || lower.includes('send feedback')) {
      speak('Submitting feedback');
      DOM.sendBtn?.click();
      return;
    }

    // Clear
    if (lower.includes('clear')) {
      speak('Clearing form');
      DOM.clearBtn?.click();
      return;
    }

    // Combined parse: name/message
    const parsed = parseCombinedVoiceCommand(lower);
    const confirmations = [];

    if (parsed.name) {
      DOM.name.value = parsed.name;
      confirmations.push(`Name set to ${parsed.name}`);
    }
    if (parsed.message) {
      DOM.message.value = parsed.message;
      confirmations.push('Message set');
    }

    if (confirmations.length) {
      const confText = confirmations.join('. ');
      DOM.status.textContent = confText;
      speak(confText);
      return;
    }

    // Single-field patterns fallback
    let m;
    m = lower.match(/(?:name is|my name is|set name to|enter name)\s+([a-z0-9 .'\-]+)/i);
    if (m) {
      DOM.name.value = m[1].trim();
      const t = `Name set to ${DOM.name.value}`;
      DOM.status.textContent = t;
      speak(t);
      return;
    }
    m = lower.match(/(?:message is|my message is|enter message|set message)\s+(.+)/i);
    if (m) {
      DOM.message.value = m[1].trim();
      const t = 'Message set';
      DOM.status.textContent = t;
      speak(t);
      return;
    }

    // fallback
    DOM.status.textContent = `Unrecognized: "${text}"`;
    speak('Command not recognized');
  };
}
