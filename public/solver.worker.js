// solver.worker.js
self.onmessage = function (e) {
  const msg = e.data || {};
  if (!msg.type || !msg.grid) {
    postMessage({ type: 'no-solution' });
    return;
  }

  const grid = msg.grid.map(r => r.slice());

  function isSafe(g, r, c, n) {
    for (let i = 0; i < 9; i++) {
      if (g[r][i] === n || g[i][c] === n) return false;
    }
    const sr = Math.floor(r / 3) * 3;
    const sc = Math.floor(c / 3) * 3;
    for (let i = sr; i < sr + 3; i++) {
      for (let j = sc; j < sc + 3; j++) {
        if (g[i][j] === n) return false;
      }
    }
    return true;
  }

  function solve(g) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (g[r][c] === 0) {
          for (let n = 1; n <= 9; n++) {
            if (isSafe(g, r, c, n)) {
              g[r][c] = n;
              if (solve(g)) return true;
              g[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  const ok = solve(grid);

  if (!ok) {
    if (msg.type === 'solve') postMessage({ type: 'no-solution' });
    else if (msg.type === 'hint') postMessage({ type: 'hint-no-solution' });
    return;
  }

  if (msg.type === 'solve') postMessage({ type: 'solved', grid });
  else if (msg.type === 'hint') postMessage({ type: 'hint-solved', grid });
};
