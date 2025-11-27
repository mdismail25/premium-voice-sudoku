// main.js
import {
  initialize,
  selectCell,
  getGridValues,
  setGridValues,
  generatePuzzle,
  insert,
  clear
} from './sudoku.js';
import { initVoice, toggleVoice, announceSelectedCell } from './voice.js';

window.addEventListener('DOMContentLoaded', () => {
  // initialize board & puzzle
  initialize();
  // initialize and auto-start voice (voice.js will try to start recognition)
  initVoice?.();

  // ---------------------------
  // 🔄 Undo stack
  // ---------------------------
  const undoStack = [];
  window.__UNDO_STACK = undoStack;

  function pushUndoSnapshot(label = '') {
    try {
      const grid = getGridValues();
      const sel = window.selectedCell || { row: 0, col: 0 };
      const snapshot = {
        grid: grid.map(row => row.slice()),
        selected: { row: sel.row, col: sel.col },
        label,
        ts: Date.now()
      };
      undoStack.push(snapshot);
      if (undoStack.length > 200) undoStack.shift();
    } catch (e) {
      console.warn('undo snapshot error', e);
    }
  }

  // ---------------------------
  // 🔊 Initial cell announcement
  // ---------------------------
  let initialSpoken = false;

  function speakInitialCellOnce() {
    if (initialSpoken) return;
    initialSpoken = true;
    try {
      announceSelectedCell?.();
    } catch (e) {
      console.warn('announceSelectedCell initial error', e);
    }
  }

  // Try after small delay on load (works only if browser allows autoplay)
  setTimeout(() => {
    speakInitialCellOnce();
  }, 800);

  // ---------------------------
  // 🔊 First-Time Welcome Message
  // ---------------------------
  function speakWelcomeGuide() {
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const msg = new SpeechSynthesisUtterance(
        "Welcome to Premium Voice Sudoku. " +
        "You can play completely using your voice. " +
        "Say commands like: up, down, left, right. " +
        "Say a number to place it. Say clear to remove. " +
        "Say solve or hint. " +
        "Say feedback to open the feedback page. " +
        "You can also say, read row, read column, undo, or set difficulty to easy, medium, or hard. " +
        "Your current cell will always be announced for accessibility."
      );
      msg.lang = "en-US";
      window.speechSynthesis.speak(msg);
    } catch (e) {
      console.warn("Welcome TTS failed", e);
    }
  }

  let welcomeShown = false;
  try {
    welcomeShown = localStorage.getItem("welcome_shown") === "yes";
  } catch (e) {
    welcomeShown = false;
  }

  function firstInteractionHandler() {
    speakInitialCellOnce();
    if (!welcomeShown) {
      speakWelcomeGuide();
      try {
        localStorage.setItem("welcome_shown", "yes");
      } catch (e) {
        // ignore storage errors
      }
      welcomeShown = true;
    }
  }

  // FIRST interaction: keyboard / mouse / touch
  ['keydown', 'mousedown', 'touchstart'].forEach(evt => {
    window.addEventListener(
      evt,
      () => {
        firstInteractionHandler();
      },
      { once: true }
    );
  });

  // Auto-play welcome once after a few seconds if allowed
  setTimeout(() => {
    if (!welcomeShown) {
      speakWelcomeGuide();
      try {
        localStorage.setItem("welcome_shown", "yes");
      } catch (e) {
        // ignore
      }
      welcomeShown = true;
    }
  }, 3000);

  // ---------------------------
  // Difficulty global (text/voice announced)
  // ---------------------------
  if (!window.currentDifficulty) {
    window.currentDifficulty = 'medium';
  }

  // ---------------------------
  // Controls
  // ---------------------------
  const newGameBtn = document.getElementById('new-game');
  if (newGameBtn) {
    newGameBtn.addEventListener('click', () => {
      // snapshot before changing puzzle
      pushUndoSnapshot('new-game:before');

      generatePuzzle();
      const msg = document.getElementById('message');
      const diff = window.currentDifficulty || 'medium';
      if (msg) msg.textContent = `New ${diff} puzzle generated`;

      try {
        announceSelectedCell?.();
      } catch (e) {
        console.warn('announceSelectedCell on new game error', e);
      }
    });
  }

  // solver worker
  const solver = new Worker('./solver.worker.js');
  window._solverWorker = solver;

  const loading = document.getElementById('loading');
  const bufferBar = document.getElementById('buffer');

  function showBuffer(text = 'Solving…') {
    try {
      if (bufferBar) {
        bufferBar.style.display = '';
        bufferBar.textContent = text;
        bufferBar.setAttribute('aria-hidden', 'false');
      }
      if (loading) loading.hidden = false;
    } catch (e) {
      console.warn('showBuffer', e);
    }
  }
  function hideBuffer() {
    try {
      if (bufferBar) {
        bufferBar.style.display = 'none';
        bufferBar.setAttribute('aria-hidden', 'true');
      }
      if (loading) loading.hidden = true;
    } catch (e) {
      console.warn('hideBuffer', e);
    }
  }

  // Expose solve helper
  window.solvePuzzle = function () {
    try {
      pushUndoSnapshot('solve:before');
      const grid = getGridValues();
      showBuffer('Solving…');
      solver.postMessage({ type: 'solve', grid });
    } catch (err) {
      hideBuffer();
      console.error('solvePuzzle error', err);
    }
  };

  // Hint helper
  window.requestHint = function requestHint() {
    try {
      const grid = getGridValues();
      pushUndoSnapshot('hint:before');
      showBuffer('Computing hint…');

      return new Promise((resolve, reject) => {
        const handler = function (e) {
          const data = e.data;
          if (!data) return;

          if (data.type === 'solved' || data.type === 'hint-solved') {
            const solved = data.grid;
            let applied = false;

            for (let r = 0; r < 9 && !applied; r++) {
              for (let c = 0; c < 9 && !applied; c++) {
                const cur = grid[r][c];
                if (!cur || cur === 0) {
                  const newVals = JSON.parse(JSON.stringify(grid));
                  newVals[r][c] = solved[r][c];
                  setGridValues(newVals, false);
                  const msgEl = document.getElementById('message');
                  if (msgEl) msgEl.textContent = `Hint placed at r${r + 1} c${c + 1}`;
                  applied = true;
                }
              }
            }

            if (!applied) {
              const msgEl = document.getElementById('message');
              if (msgEl) msgEl.textContent = 'No hints available';
            }

            hideBuffer();
            solver.removeEventListener('message', handler);
            resolve(applied);
            return;
          }

          if (data.type === 'no-solution' || data.type === 'error') {
            hideBuffer();
            solver.removeEventListener('message', handler);
            reject(new Error('No solution'));
            return;
          }
        };

        solver.addEventListener('message', handler);
        solver.postMessage({ type: 'solve', grid });
      });
    } catch (err) {
      hideBuffer();
      return Promise.reject(err);
    }
  };

  // Solve button
  const solveBtn = document.getElementById('solve');
  if (solveBtn) {
    solveBtn.addEventListener('click', () => {
      window.solvePuzzle();
    });
  }

  // Hint button
  const hintBtn =
    document.getElementById('hintBtn') ||
    document.getElementById('hint') ||
    document.getElementById('ai-hint');

  if (hintBtn) {
    hintBtn.addEventListener('click', () => {
      if (typeof window.requestHint === 'function') {
        window.requestHint().catch(() => {
          const msg = document.getElementById('message');
          if (msg) {
            msg.textContent = 'Hint failed';
            setTimeout(() => (msg.textContent = ''), 2000);
          }
        });
      } else {
        const msg = document.getElementById('message');
        if (msg) {
          msg.textContent = 'No hint available';
          setTimeout(() => (msg.textContent = ''), 2000);
        }
      }
    });
  }

  // Worker messages
  solver.onmessage = (e) => {
    try {
      hideBuffer();
    } catch (e2) {}
    const data = e.data;
    if (data && data.type === 'solved') {
      setGridValues(data.grid, false);
      const m = document.getElementById('message');
      if (m) m.textContent = 'Solved by worker';
    } else if (data && (data.type === 'no-solution' || data.type === 'error')) {
      const m = document.getElementById('message');
      if (m) m.textContent = 'No solution';
    }
  };

  // 🎙️ Voice button (optional manual toggle)
  const listenBtn = document.getElementById('listen');
  if (listenBtn) {
    listenBtn.addEventListener('click', () => {
      const micOn = toggleVoice?.() ?? false;

      if (window.__ULTIMATE_BG_TOGGLE_MIC) {
        window.__ULTIMATE_BG_TOGGLE_MIC();
      }

      const btn = document.getElementById('listen');
      if (btn) btn.setAttribute('aria-pressed', micOn ? 'true' : 'false');

      try {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(
            micOn ? 'Listening' : 'Stopped listening'
          );
          u.lang = 'en-US';
          window.speechSynthesis.speak(u);
        }
      } catch (e) {
        console.warn('TTS toggle error', e);
      }

      const vs = document.getElementById('voice-status');
      if (vs) {
        vs.textContent = micOn ? '🎙️ Listening...' : 'Not listening';
      }
    });
  }

  const stopVoiceBtn = document.getElementById('stop-voice');
  if (stopVoiceBtn) {
    stopVoiceBtn.addEventListener('click', () => {
      const b = document.getElementById('listen');
      if (b) b.setAttribute('aria-pressed', 'false');
    });
  }

  // Number pad
  document.querySelectorAll('.pad').forEach(btn => {
    btn.addEventListener('click', () => {
      const txt = btn.textContent.trim();
      // Snapshot BEFORE mutations
      pushUndoSnapshot('pad:before');
      if (txt === 'Clear' || btn.id === 'clear-cell') {
        clear();
        announceSelectedCell?.();
      } else {
        insert(parseInt(txt, 10));
        announceSelectedCell?.();
      }
    });
  });

  // Keyboard navigation + speech
  window.addEventListener('keydown', (e) => {
    const sel = window.selectedCell || { row: 0, col: 0 };

    if (e.key === 'ArrowUp') {
      selectCell(Math.max(0, sel.row - 1), sel.col);
      announceSelectedCell?.();
    } else if (e.key === 'ArrowDown') {
      selectCell(Math.min(8, sel.row + 1), sel.col);
      announceSelectedCell?.();
    } else if (e.key === 'ArrowLeft') {
      selectCell(sel.row, Math.max(0, sel.col - 1));
      announceSelectedCell?.();
    } else if (e.key === 'ArrowRight') {
      selectCell(sel.row, Math.min(8, sel.col + 1));
      announceSelectedCell?.();
    } else if (e.key >= '1' && e.key <= '9') {
      pushUndoSnapshot('keyboard-insert:before');
      insert(parseInt(e.key, 10));
      announceSelectedCell?.();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      pushUndoSnapshot('keyboard-clear:before');
      clear();
      announceSelectedCell?.();
    }
  });
});

// ---------------------------
// Neon Background Animation
// ---------------------------
const c = document.getElementById('neonCanvas');
if (c) {
  const ctx = c.getContext('2d');

  function resize() {
    c.width = innerWidth;
    c.height = innerHeight;
  }
  resize();
  addEventListener('resize', resize);

  let particles = [...Array(80)].map(() => ({
    x: Math.random() * c.width,
    y: Math.random() * c.height,
    vx: (Math.random() - 0.5) * 0.6,
    vy: (Math.random() - 0.5) * 0.6,
    r: 2 + Math.random() * 3
  }));

  function neon() {
    ctx.clearRect(0, 0, c.width, c.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > c.width) p.vx *= -1;
      if (p.y < 0 || p.y > c.height) p.vy *= -1;

      ctx.beginPath();
      ctx.fillStyle = 'rgba(0,255,255,0.7)';
      ctx.shadowColor = '#0ff';
      ctx.shadowBlur = 15;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    requestAnimationFrame(neon);
  }
  neon();
}
