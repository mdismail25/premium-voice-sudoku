// feedback.js - voice-enabled feedback page (no email)
// - Form handling (POST to /feedback or fallback to localStorage queue)
// - Voice commands with continuous listening toggle
// - Combined voice parsing: "enter name john and message I love your app"
// - TTS confirmations and UI status updates
// - Redirects back to index.html after successful send or local save
// - NEW: auto-on mic like Sudoku page, continuous listening,
//        and "stop listening / stop listing / stop voice / mic off" command

const DOM = {
  form: null,
  name: null,
  message: null,
  status: null,
  clearBtn: null,
  sendBtn: null,
  listenBtn: null
};

// small ignore window so recognition doesn't hear itself on this page
if (!window.__FB_SPEAKING_UNTIL) {
  window.__FB_SPEAKING_UNTIL = 0;
}

function speak(text) {
  try {
    if (!window.speechSynthesis || !text) return;
    const now = Date.now();
    const ms = 2500 + Math.floor(Math.random() * 800); // ~2.5–3.3 seconds
    window.__FB_SPEAKING_UNTIL = Math.max(window.__FB_SPEAKING_UNTIL || 0, now + ms);

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

  // Clear button handler
  if (DOM.clearBtn) {
    DOM.clearBtn.addEventListener('click', () => {
      DOM.form.reset();
      DOM.status.textContent = 'Form cleared';
      speak('Form cleared');
      setTimeout(() => { if (DOM.status) DOM.status.textContent = ''; }, 1600);
      if (DOM.name) DOM.name.focus();
    });
  }

  // Submit handler: posts to server or saves locally, then redirect back
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

    // Try server POST
    try {
      const resp = await fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
        DOM.status.textContent = 'Thanks — your feedback was sent.';
        speak('Thanks, your feedback was sent');
        DOM.form.reset();
        setTimeout(() => { window.location.href = 'index.html'; }, 900);
        return;
      } else {
        console.warn('Feedback endpoint returned', resp.status);
      }
    } catch (e) {
      console.warn('Feedback POST failed, saving locally', e);
    }

    // Fallback: save locally then redirect
    try {
      const key = 'neun_feedback_queue';
      const queue = JSON.parse(localStorage.getItem(key) || '[]');
      queue.push(payload);
      localStorage.setItem(key, JSON.stringify(queue));
      DOM.status.textContent = 'Saved locally (no server). Will retry when available.';
      speak('Saved locally. I will retry when the server is available');
      DOM.form.reset();
      setTimeout(() => { window.location.href = 'index.html'; }, 900);
    } catch (e) {
      DOM.status.textContent = 'Failed to save feedback locally.';
      console.error('feedback save error', e);
      speak('Failed to save feedback locally');
    }
  });

  // background retry attempt (silent)
  (async function tryFlushQueue(){
    try {
      const key = 'neun_feedback_queue';
      const q = JSON.parse(localStorage.getItem(key) || '[]');
      if (!q.length) return;
      for (let i = 0; i < q.length; i++) {
        try {
          const r = await fetch('/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(q[i])
          });
          if (r.ok) {
            q.splice(i, 1);
            i--;
          }
        } catch (er) {
          break;
        }
      }
      localStorage.setItem(key, JSON.stringify(q));
    } catch (e) { /* ignore */ }
  })();

  // Initialize continuous voice (toggleable & auto-on)
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
  let userRequestedOn = false;

  function updateUI() {
    if (!DOM.listenBtn) return;
    DOM.listenBtn.setAttribute('aria-pressed', listening ? 'true' : 'false');
    DOM.listenBtn.classList.toggle('listening', listening);
    DOM.listenBtn.textContent = listening ? '🎙️ Listening...' : '🎙️ Listen';
  }

  // Toggle continuous listening on click
  if (DOM.listenBtn) {
    DOM.listenBtn.addEventListener('click', () => {
      try {
        if (!listening) {
          userRequestedOn = true;
          rec.start();
        } else {
          userRequestedOn = false;
          rec.stop();
        }
      } catch (e) {
        console.warn('rec toggle error', e);
      }
    });
  }

  rec.onstart = () => {
    listening = true;
    updateUI();
    speak('Listening');
  };

  rec.onend = () => {
    listening = false;
    updateUI();
    if (userRequestedOn) {
      // auto-restart for continuous mode
      try { rec.start(); } catch (e) { console.warn('restart failed', e); }
    } else {
      speak('Stopped listening');
    }
  };

  rec.onerror = (err) => {
    console.warn('feedback voice error', err);
    if (DOM.status) DOM.status.textContent = 'Voice error';
    listening = false;
    userRequestedOn = false;
    updateUI();
  };

  rec.onresult = (e) => {
    const now = Date.now();
    // ignore our own speech
    if (now < (window.__FB_SPEAKING_UNTIL || 0)) {
      console.log('[feedback voice] ignored during self-speech');
      return;
    }

    const text = (e.results[e.resultIndex][0].transcript || '').trim();
    const lower = text.toLowerCase();
    if (!text) return;

    if (DOM.status) DOM.status.textContent = `Heard: "${text}"`;
    speak(`Heard: ${text}`);

    // STOP LISTENING via voice
    if (
      lower.includes('stop listening') ||
      lower.includes('stop listing') ||
      lower.includes('stop voice') ||
      lower.includes('mic off')
    ) {
      userRequestedOn = false;
      try { rec.stop(); } catch {}
      if (DOM.status) DOM.status.textContent = 'Stopped listening by voice command';
      return;
    }

    // Commands: navigation to Sudoku
    if (lower.includes('sudoku') || lower.includes('go back') || lower.includes('back')) {
      speak('Going back to Sudoku');
      window.location.href = 'index.html';
      return;
    }

    // Submit
    if (
      lower.includes('send feedback') ||
      lower.includes('submit feedback') ||
      lower === 'send' ||
      lower === 'submit'
    ) {
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

  // 🔥 Auto-start mic like Sudoku page (where browser allows)
  try {
    userRequestedOn = true;
    rec.start();
  } catch (e) {
    console.warn('feedback auto-start may be blocked until user interacts', e);
  }
}
