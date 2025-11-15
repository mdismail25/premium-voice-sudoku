// main.js
import { initialize, selectCell, getGridValues, setGridValues, generatePuzzle, insert, clear } from './sudoku.js';
import { initVoice, toggleVoice } from './voice.js';

window.addEventListener('DOMContentLoaded', () => {
  // initialize board & puzzle
  initialize();

  // controls
  document.getElementById('new-game').addEventListener('click', () => {
    generatePuzzle();
    const msg = document.getElementById('message');
    if (msg) msg.textContent = 'New puzzle generated';
  });

  // solver worker
  const solver = new Worker('./solver.worker.js');
  // expose for debugging / optional external use
  window._solverWorker = solver;

  const loading = document.getElementById('loading');
  // your HTML used id="buffer" previously — we support both
  const bufferBar = document.getElementById('buffer');

  function showBuffer(text = 'Solving…') {
    try {
      if (bufferBar) {
        bufferBar.style.display = '';
        bufferBar.textContent = text;
        bufferBar.setAttribute('aria-hidden', 'false');
      }
      if (loading) loading.hidden = false;
    } catch (e) { console.warn('showBuffer', e); }
  }
  function hideBuffer() {
    try {
      if (bufferBar) {
        bufferBar.style.display = 'none';
        bufferBar.setAttribute('aria-hidden', 'true');
      }
      if (loading) loading.hidden = true;
    } catch (e) { console.warn('hideBuffer', e); }
  }

  // Expose solve helper so buttons/voice can call it consistently
  window.solvePuzzle = function () {
    try {
      const grid = getGridValues();
      showBuffer('Solving…');
      solver.postMessage({ type: 'solve', grid });
    } catch (err) {
      hideBuffer();
      console.error('solvePuzzle error', err);
    }
  };

  // Request a single-cell hint: solve in worker then apply ONE cell
  window.requestHint = function requestHint() {
    try {
      const grid = getGridValues();
      showBuffer('Computing hint…');

      return new Promise((resolve, reject) => {
        const handler = function (e) {
          const data = e.data;
          if (!data) return;

          if (data.type === 'solved' || data.type === 'hint-solved') {
            const solved = data.grid;
            let applied = false;

            // find first empty cell in current grid and set it
            for (let r = 0; r < 9 && !applied; r++) {
              for (let c = 0; c < 9 && !applied; c++) {
                const cur = grid[r][c];
                if (!cur || cur === 0) {
                  const newVals = JSON.parse(JSON.stringify(grid));
                  newVals[r][c] = solved[r][c];
                  // markPrefilled = false (so hint isn't locked as a given)
                  setGridValues(newVals, false);
                  const msgEl = document.getElementById('message');
                  if (msgEl) msgEl.textContent = `Hint placed at r${r+1} c${c+1}`;
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

        // listen once for this hint response
        solver.addEventListener('message', handler);

        // ask the worker to solve the grid copy
        solver.postMessage({ type: 'solve', grid });
      });
    } catch (err) {
      hideBuffer();
      return Promise.reject(err);
    }
  };

  // wire Solve button to helper (keeps original behaviour but uses our helper)
  const solveBtn = document.getElementById('solve');
  if (solveBtn) {
    solveBtn.addEventListener('click', () => {
      window.solvePuzzle();
    });
  }

  // wire Hint button (your HTML uses id="hintBtn")
  const hintBtn = document.getElementById('hintBtn') || document.getElementById('hint') || document.getElementById('ai-hint');
  if (hintBtn) {
    hintBtn.addEventListener('click', () => {
      if (typeof window.requestHint === 'function') {
        window.requestHint().catch(() => {
          const msg = document.getElementById('message');
          if (msg) { msg.textContent = 'Hint failed'; setTimeout(()=> msg.textContent = '', 2000); }
        });
      } else {
        const msg = document.getElementById('message');
        if (msg) { msg.textContent = 'No hint available'; setTimeout(()=> msg.textContent = '', 2000); }
      }
    });
  }

  // solver message handler (keeps original behaviour but also controls buffer)
  solver.onmessage = (e) => {
    try { hideBuffer(); } catch (e) {}
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

  // ---------------------------
  // 🎙️ VOICE BUTTON (UPDATED)
  // ---------------------------
  const listenBtn = document.getElementById('listen');
  if (listenBtn) {
    listenBtn.addEventListener('click', () => {
      toggleVoice(); // your existing voice toggle

      // optional background mic toggle (if defined by other script)
      if (window.__ULTIMATE_BG_TOGGLE_MIC) {
        window.__ULTIMATE_BG_TOGGLE_MIC();
      }

      // update button UI
      const btn = document.getElementById('listen');
      const pressed = btn.getAttribute('aria-pressed') === 'true';
      btn.setAttribute('aria-pressed', String(!pressed));
    });
  }

  const stopVoiceBtn = document.getElementById('stop-voice');
  if (stopVoiceBtn) {
    stopVoiceBtn.addEventListener('click', () => {
      const b = document.getElementById('listen');
      if (b) b.setAttribute('aria-pressed', 'false');
    });
  }

  // ---------------------------
  // Number pad
  // ---------------------------
  document.querySelectorAll('.pad').forEach(btn => {
    btn.addEventListener('click', () => {
      const txt = btn.textContent.trim();
      if (txt === 'Clear' || btn.id === 'clear-cell') clear();
      else insert(parseInt(txt, 10));
    });
  });

  // ---------------------------
  // Keyboard navigation
  // ---------------------------
  window.addEventListener('keydown', (e) => {
    const sel = window.selectedCell || { row: 0, col: 0 };

    if (e.key === 'ArrowUp') selectCell(Math.max(0, sel.row - 1), sel.col);
    else if (e.key === 'ArrowDown') selectCell(Math.min(8, sel.row + 1), sel.col);
    else if (e.key === 'ArrowLeft') selectCell(sel.row, Math.max(0, sel.col - 1));
    else if (e.key === 'ArrowRight') selectCell(sel.row, Math.min(8, sel.col + 1));
    else if (e.key >= '1' && e.key <= '9') insert(parseInt(e.key, 10));
    else if (e.key === 'Backspace' || e.key === 'Delete') clear();
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
