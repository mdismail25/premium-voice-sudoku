// Game state & helpers
export let selected = { row: 0, col: 0 };

const GRID_SIZE = 9;
let prefilledMask = []; // boolean mask for prefilled cells

// Create grid DOM
export function createGrid() {
  const grid = document.getElementById('game-grid');
  grid.innerHTML = '';
  prefilledMask = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const div = document.createElement('div');
      div.className = 'cell';
      div.dataset.row = r;
      div.dataset.col = c;

      if ((c + 1) % 3 === 0 && c !== GRID_SIZE - 1) div.classList.add('block-right');
      if ((r + 1) % 3 === 0 && r !== GRID_SIZE - 1) div.classList.add('block-bottom');

      div.tabIndex = 0;
      div.addEventListener('click', () => selectCell(r, c));
      div.addEventListener('keydown', (e) => {
        if (e.key >= '1' && e.key <= '9') {
          insert(+e.key);
        } else if (e.key === 'Backspace' || e.key === 'Delete') clear();
      });

      grid.appendChild(div);
    }
  }
}

// Select cell visually & update selected state
export function selectCell(row, col) {
  const prev = document.querySelector('.cell.selected');
  if (prev) prev.classList.remove('selected');

  const cell = getCell(row, col);
  if (!cell) return;
  cell.classList.add('selected');

  selected = { row, col };
  try { window.selectedCell = selected; } catch (e) {}

  cell.focus();

  announce(`Selected row ${row + 1}, column ${col + 1}`);
}

export function getSelected() {
  return selected;
}

export function getCell(row, col) {
  return document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
}

// Insert number at selected position (if not prefilled)
export function insert(n) {
  const cell = getCell(selected.row, selected.col);
  if (!cell) return;
  if (prefilledMask[selected.row][selected.col]) {
    speak('Cell is fixed');
    return;
  }
  if (!isValidMove(selected.row, selected.col, n)) {
    cell.classList.add('invalid');
    setTimeout(() => cell.classList.remove('invalid'), 350);
    speak(`${n} is not valid here`);
    announce(`Invalid: ${n}`);
    return;
  }
  cell.textContent = n;
  speak(`Inserted ${n}`);
  announce(`Inserted ${n}`);
  checkWinNotify();
}

// Clear selected (clears cell text if not prefilled)
export function clear() {
  const cell = getCell(selected.row, selected.col);
  if (!cell) return;
  if (prefilledMask[selected.row][selected.col]) {
    speak('Cell is fixed');
    return;
  }
  cell.textContent = '';
  speak('Cleared');
}

// Get grid values (2D array)
export function getGridValues() {
  const grid = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    const row = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = getCell(r, c).textContent;
      row.push(v ? parseInt(v) : 0);
    }
    grid.push(row);
  }
  return grid;
}

// Set grid values, and optionally mark prefilled (locked) cells
export function setGridValues(values, markPrefilled = true) {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = getCell(r, c);
      cell.textContent = values[r][c] || '';
      if (markPrefilled && values[r][c]) {
        cell.classList.add('prefilled');
        prefilledMask[r][c] = true;
      } else {
        cell.classList.remove('prefilled');
        prefilledMask[r][c] = false;
      }
    }
  }
  selectCell(selected.row || 0, selected.col || 0);
}

// Validate a move against current grid (no duplicates row/col/box)
export function isValidMove(row, col, num) {
  const g = getGridValues();
  for (let c = 0; c < GRID_SIZE; c++) if (c !== col && g[row][c] === num) return false;
  for (let r = 0; r < GRID_SIZE; r++) if (r !== row && g[r][col] === num) return false;
  const sr = Math.floor(row / 3) * 3, sc = Math.floor(col / 3) * 3;
  for (let r = sr; r < sr + 3; r++) for (let c = sc; c < sc + 3; c++) if (!(r === row && c === col) && g[r][c] === num) return false;
  return true;
}

// Win detection
export function isWin() {
  const g = getGridValues();
  for (let r = 0; r < GRID_SIZE; r++) for (let c = 0; c < GRID_SIZE; c++) if (g[r][c] === 0 || !isValidMove(r, c, g[r][c])) return false;
  return true;
}

function checkWinNotify() {
  if (isWin()) {
    speak('Congratulations! Puzzle completed');
    document.getElementById('message').textContent = '🎉 You solved the puzzle!';
  }
}

/* Puzzle generator (full -> remove) */
export function generatePuzzle(removeCount = 45) {
  const full = generateFull();
  let puzzle = full.map(r => r.slice());

  let removed = 0;
  let attempts = 200;
  while (removed < removeCount && attempts-- > 0) {
    const r = Math.floor(Math.random() * 9);
    const c = Math.floor(Math.random() * 9);
    if (puzzle[r][c] === 0) continue;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;

    const copy = puzzle.map(rr => rr.slice());
    if (!internalSolve(copy)) {
      puzzle[r][c] = backup;
    } else {
      removed++;
    }
  }

  setGridValues(puzzle, true);
  selectCell(0, 0);
}

function generateFull() {
  const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  const numbers = [1,2,3,4,5,6,7,8,9];

  function fill() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === 0) {
          const shuffled = numbers.slice().sort(() => Math.random() - 0.5);
          for (const n of shuffled) {
            if (isSafeLocal(grid, r, c, n)) {
              grid[r][c] = n;
              if (fill()) return true;
              grid[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }
  fill();
  return grid;
}

function isSafeLocal(g, r, c, n) {
  for (let i = 0; i < 9; i++) if (g[r][i] === n || g[i][c] === n) return false;
  const sr = Math.floor(r / 3) * 3, sc = Math.floor(c / 3) * 3;
  for (let i = sr; i < sr + 3; i++) for (let j = sc; j < sc + 3; j++) if (g[i][j] === n) return false;
  return true;
}

// internal solver used for solvability checks (backtracking)
function internalSolve(g) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (g[r][c] === 0) {
        for (let n = 1; n <= 9; n++) {
          if (isSafeLocal(g, r, c, n)) {
            g[r][c] = n;
            if (internalSolve(g)) return true;
            g[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

/* revealCell(row,col,val) -> set value and mark prefilled */
export function revealCell(row, col, val) {
  const cell = getCell(row, col);
  if (!cell) return;
  cell.textContent = val;
  cell.classList.add('prefilled');
  prefilledMask[row][col] = true;
  selectCell(row, col);
}

/* Speech helpers */
export function speak(text) {
  try {
    if (!('speechSynthesis' in window)) return;
    const s = new SpeechSynthesisUtterance(text);
    s.lang = 'en-US';
    window.speechSynthesis.speak(s);
  } catch (err) {
    console.warn('TTS not available', err);
  }
}
export function announce(text) {
  const msg = document.getElementById('message');
  if (msg) msg.textContent = text;
}

/* Init */
export function initialize() {
  createGrid();
  generatePuzzle();
  selectCell(0,0);
}
