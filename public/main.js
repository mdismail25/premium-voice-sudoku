// main.js
import { initialize, selectCell, getGridValues, setGridValues, generatePuzzle, insert, clear } from './sudoku.js';
import { initVoice, toggleVoice } from './voice.js';

window.addEventListener('DOMContentLoaded', () => {
  // initialize board & puzzle
  initialize();

  // controls
  document.getElementById('new-game').addEventListener('click', () => {
    generatePuzzle();
    document.getElementById('message').textContent = 'New puzzle generated';
  });

  // solver worker
  const solver = new Worker('./solver.worker.js');
  const loading = document.getElementById('loading');

  document.getElementById('solve').addEventListener('click', () => {
    const grid = getGridValues();
    loading.hidden = false;
    solver.postMessage({ type: 'solve', grid });
  });

  solver.onmessage = (e) => {
    loading.hidden = true;
    const data = e.data;
    if (data.type === 'solved') {
      setGridValues(data.grid, false);
      document.getElementById('message').textContent = 'Solved by worker';
    } else {
      document.getElementById('message').textContent = 'No solution';
    }
  };

  // ---------------------------
  // 🎙️ VOICE BUTTON (UPDATED)
  // ---------------------------
  document.getElementById('listen').addEventListener('click', () => {
    toggleVoice(); // your existing voice toggle

    // NEW → background mic toggle
    if (window.__ULTIMATE_BG_TOGGLE_MIC) {
      window.__ULTIMATE_BG_TOGGLE_MIC();
    }

    // update button UI
    const btn = document.getElementById('listen');
    const pressed = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', String(!pressed));
  });

  document.getElementById('stop-voice').addEventListener('click', () => {
    document.getElementById('listen').setAttribute('aria-pressed', 'false');
  });

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
