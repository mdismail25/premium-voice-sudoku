// voice.js — voice engine with blind-user accessibility + extra features
// - Auto-start listening (where browser allows)
// - Speaks cell info after moves (voice + keyboard via helper)
// - Validates number inserts and announces conflicts + beep
// - Commands: read row/column/cell/board
// - Undo command
// - Difficulty level commands (easy/medium/hard) announced by voice
// - Navigate to feedback page via voice
// - Ignores recognition while the app itself is speaking to prevent "echo" commands
//   (IGNORE WINDOW set to 5-6 seconds after each speak)

import {
  insert,
  selectCell,
  clear,
  generatePuzzle,
  speak as ttsSpeak,
  announce,
  selected,
  getGridValues,
  setGridValues
} from "./sudoku.js";

let recognition = null;
let listening = false;
let processing = false;
let userRequestedOn = false;
let lastTranscript = "";
let lastTranscriptAt = 0;

const DEBOUNCE_MS = 1200;
const DUPLICATE_WINDOW_MS = 2500;
const RESTART_DELAY_MS = 400;

const NUMBER_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};

// global flag: until this timestamp we ignore recognition results (to avoid hearing our own TTS)
if (!window.__VOICE_SPEAKING_UNTIL) {
  window.__VOICE_SPEAKING_UNTIL = 0;
}

// --------------------
// Utility: similarity (duplicate suppression)
// --------------------
function similarEnough(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  if (Math.abs(a.length - b.length) <= 2) {
    let diff = 0;
    const L = Math.min(a.length, b.length);
    for (let i = 0; i < L; i++) if (a[i] !== b[i]) diff++;
    diff += Math.abs(a.length - b.length);
    return diff <= 2;
  }
  return false;
}

export function parseNumberFromText(text) {
  const direct = text.match(/\b([1-9])\b/);
  if (direct) return parseInt(direct[1], 10);

  for (const [w, n] of Object.entries(NUMBER_WORDS)) {
    if (text.includes(w)) return n;
  }
  return null;
}

// --------------------
// Beep helper for errors / invalid moves
// --------------------
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {
    // if audio context not available, silently ignore
  }
}

// --------------------
// TTS helpers & grid helpers
// --------------------
function safeSpeak(txt) {
  try {
    if (!txt) return;

    // NEW: enforce a 5-6 second ignore window after each app speech
    const now = Date.now();
    const ms5000to6000 = 5000 + Math.floor(Math.random() * 1001); // 5000..6000 ms
    window.__VOICE_SPEAKING_UNTIL = Math.max(window.__VOICE_SPEAKING_UNTIL || 0, now + ms5000to6000);

    if (typeof ttsSpeak === "function") {
      ttsSpeak(txt);
    } else if (window && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(txt);
      u.lang = "en-US";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  } catch (e) {
    console.warn("TTS error", e);
  }
}

function getSelectedPos() {
  if (selected && typeof selected.row === "number" && typeof selected.col === "number") {
    return { row: selected.row, col: selected.col };
  }
  if (window.selected && typeof window.selected.row === "number") {
    return { row: window.selected.row, col: window.selected.col };
  }
  return null;
}

function speakCellInfo(r, c) {
  try {
    const grid = getGridValues();
    if (!grid || !grid[r]) {
      safeSpeak("Cell is not available");
      return;
    }
    const val = grid[r][c];
    const rc = `Row ${r + 1}, Column ${c + 1}`;
    if (val && val !== 0) {
      safeSpeak(`${rc}, value ${val}`);
    } else {
      safeSpeak(`${rc}, empty`);
    }
  } catch (e) {
    console.warn("speakCellInfo error", e);
  }
}

// Exported so keyboard navigation & UI can speak current cell
export function announceSelectedCell() {
  const pos = getSelectedPos();
  if (!pos) {
    safeSpeak("No cell selected");
    return;
  }
  speakCellInfo(pos.row, pos.col);
}

function isMoveValid(grid, r, c, n) {
  // Check row
  for (let j = 0; j < 9; j++) {
    if (j === c) continue;
    if (grid[r][j] === n) return { ok: false, reason: "row" };
  }
  // Check column
  for (let i = 0; i < 9; i++) {
    if (i === r) continue;
    if (grid[i][c] === n) return { ok: false, reason: "column" };
  }
  // Check box
  const sr = Math.floor(r / 3) * 3;
  const sc = Math.floor(c / 3) * 3;
  for (let i = sr; i < sr + 3; i++) {
    for (let j = sc; j < sc + 3; j++) {
      if (i === r && j === c) continue;
      if (grid[i][j] === n) return { ok: false, reason: "box" };
    }
  }
  return { ok: true };
}

function attemptInsertAtSelected(n) {
  const pos = getSelectedPos();
  if (!pos) {
    playBeep();
    safeSpeak("No cell selected");
    return;
  }
  const { row, col } = pos;
  const grid = getGridValues();
  if (!grid || !grid[row]) {
    playBeep();
    safeSpeak("Grid data not available");
    return;
  }

  if (grid[row][col] === n) {
    safeSpeak(`Cell already contains ${n}`);
    return;
  }

  const res = isMoveValid(grid, row, col, n);
  if (!res.ok) {
    playBeep();
    if (res.reason === "row") safeSpeak(`Cannot insert ${n}: conflict in row`);
    else if (res.reason === "column") safeSpeak(`Cannot insert ${n}: conflict in column`);
    else if (res.reason === "box") safeSpeak(`Cannot insert ${n}: conflict in box`);
    else safeSpeak(`Cannot insert ${n}: conflict`);
    return;
  }

  try {
    insert(n);
    safeSpeak(`Inserted ${n}`);
    speakCellInfo(row, col);
  } catch (e) {
    console.warn("insert error", e);
    playBeep();
    safeSpeak("Insert failed");
  }
}

// Read an entire row (1-indexed for user)
function readRowOneBased(n) {
  const rowIndex = Number(n) - 1;
  if (isNaN(rowIndex) || rowIndex < 0 || rowIndex > 8) {
    safeSpeak("Invalid row number");
    return;
  }
  const g = getGridValues();
  if (!g || !g[rowIndex]) {
    safeSpeak("Grid not available");
    return;
  }
  const parts = [];
  for (let c = 0; c < 9; c++) {
    const v = g[rowIndex][c];
    parts.push(v && v !== 0 ? String(v) : "blank");
  }
  safeSpeak(`Row ${rowIndex + 1}: ${parts.join(", ")}`);
}

// Read an entire column (1-indexed)
function readColumnOneBased(n) {
  const colIndex = Number(n) - 1;
  if (isNaN(colIndex) || colIndex < 0 || colIndex > 8) {
    safeSpeak("Invalid column number");
    return;
  }
  const g = getGridValues();
  if (!g) {
    safeSpeak("Grid not available");
    return;
  }
  const parts = [];
  for (let r = 0; r < 9; r++) {
    const v = g[r][colIndex];
    parts.push(v && v !== 0 ? String(v) : "blank");
  }
  safeSpeak(`Column ${colIndex + 1}: ${parts.join(", ")}`);
}

// Read specified cell by row/col
function readCellByRowCol(rStr, cStr) {
  const r = Number(rStr) - 1;
  const c = Number(cStr) - 1;
  if (isNaN(r) || isNaN(c) || r < 0 || r > 8 || c < 0 || c > 8) {
    safeSpeak("Invalid row or column");
    return;
  }
  speakCellInfo(r, c);
}

// Read entire board (verbose)
function readEntireBoard() {
  const g = getGridValues();
  if (!g) {
    safeSpeak("Grid not available");
    return;
  }
  for (let r = 0; r < 9; r++) {
    const parts = [];
    for (let c = 0; c < 9; c++) {
      const v = g[r][c];
      parts.push(v && v !== 0 ? String(v) : "blank");
    }
    safeSpeak(`Row ${r + 1}: ${parts.join(", ")}`);
  }
}

// --------------------
// Undo support (uses global undo stack from main.js)
function performUndo() {
  const stack = window.__UNDO_STACK || [];
  if (!stack.length) {
    playBeep();
    safeSpeak("Nothing to undo");
    return;
  }
  const snap = stack.pop();
  try {
    if (snap.grid) {
      setGridValues(snap.grid, false);
    }
    if (snap.selected && typeof snap.selected.row === "number") {
      selectCell(snap.selected.row, snap.selected.col);
      speakCellInfo(snap.selected.row, snap.selected.col);
    } else {
      safeSpeak("Undid last move");
    }
  } catch (e) {
    console.warn("undo failed", e);
    playBeep();
    safeSpeak("Undo failed");
  }
}

// --------------------
// Difficulty support (voice only, puzzle generation unchanged)
function setDifficulty(level) {
  const lv = (level || "").toLowerCase();
  let normalized = null;
  if (lv.includes("easy")) normalized = "easy";
  else if (lv.includes("medium")) normalized = "medium";
  else if (lv.includes("hard")) normalized = "hard";

  if (!normalized) {
    safeSpeak("Unknown difficulty");
    return;
  }

  window.currentDifficulty = normalized;
  const msgEl = document.getElementById("message");
  if (msgEl) msgEl.textContent = `Difficulty set to ${normalized}`;
  safeSpeak(`Difficulty set to ${normalized}. Use new game to start a ${normalized} puzzle.`);
}

// -------------------------------
// Main voice recognition init & toggle
export function initVoice() {
  if (recognition) return;

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    const vs = document.getElementById("voice-status");
    if (vs) vs.textContent = "SpeechRecognition not supported";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true; // keep this; we ignore during speaking anyway
  recognition.lang = "en-US";
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    listening = true;
    const btn = document.getElementById("listen");
    if (btn) btn.setAttribute("aria-pressed", "true");
    const vs = document.getElementById("voice-status");
    if (vs) vs.textContent = "🎙️ Listening...";
  };

  recognition.onend = () => {
    listening = false;
    const btn = document.getElementById("listen");
    if (btn) btn.setAttribute("aria-pressed", "false");

    const vs = document.getElementById("voice-status");
    if (vs) vs.textContent = userRequestedOn ? "Click to resume" : "Not listening";

    if (userRequestedOn && !processing) {
      setTimeout(() => {
        try {
          recognition.start();
        } catch (e) {
          console.warn("[voice] restart failed", e);
        }
      }, 300);
    }
  };

  recognition.onerror = (e) => {
    console.error("[voice] error", e);
    const vs = document.getElementById("voice-status");
    if (vs) vs.textContent = "Voice error";
  };

  recognition.onresult = async (evt) => {
    let interim = "",
      final = "";

    for (let i = evt.resultIndex; i < evt.results.length; i++) {
      const r = evt.results[i];
      if (r.isFinal) final += r[0].transcript + " ";
      else interim += r[0].transcript + " ";
    }

    interim = interim.trim();
    final = final.trim();

    const now = Date.now();

    // 🔐 Ignore recognition while we are speaking ourselves (5-6 seconds)
    if (now < (window.__VOICE_SPEAKING_UNTIL || 0)) {
      console.log("[voice] Ignored transcript during self-speech:", final || interim);
      return;
    }

    if (interim) {
      const vs = document.getElementById("voice-status");
      if (vs) vs.textContent = "📝 " + interim;
    }

    if (!final) return;

    const transcript = final.toLowerCase().trim();
    if (!transcript) return;

    if (processing) return;

    if (
      similarEnough(transcript, lastTranscript) &&
      now - lastTranscriptAt < DUPLICATE_WINDOW_MS
    ) {
      console.log("[voice] duplicate suppressed:", transcript);
      return;
    }

    const words = transcript.split(/\s+/).filter(Boolean);
    const isSingleNum =
      /^\d$/.test(transcript) ||
      Object.keys(NUMBER_WORDS).includes(transcript);
    const knownShort = [
      "up",
      "down",
      "left",
      "right",
      "clear",
      "delete",
      "remove",
      "solve",
      "reset",
      "new",
      "start",
      "hint",
      "feedback",
      "what",
      "read",
      "undo",
      "easy",
      "hard",
      "medium"
    ];
    const isShortCmd =
      words.length === 1 && knownShort.includes(transcript);

    if (words.length === 1 && !isSingleNum && !isShortCmd) {
      window.dispatchEvent(
        new CustomEvent("voice:ambiguous", {
          detail: { transcript },
        })
      );
      return;
    }

    processing = true;
    try {
      recognition.stop();
    } catch {}

    announce(`Heard: ${transcript}`);
    lastTranscript = transcript;
    lastTranscriptAt = now;

    await handleCommand(transcript);

    processing = false;

    setTimeout(() => {
      if (userRequestedOn) {
        try {
          recognition.start();
        } catch (e) {
          console.warn("[voice] restart error:", e);
        }
      }
    }, RESTART_DELAY_MS);
  };

  // Auto-start listening on page load (where browser allows it)
  try {
    userRequestedOn = true;
    recognition.start();
  } catch (e) {
    console.warn("[voice] auto-start may be blocked until user interacts", e);
  }
}

export function toggleVoice() {
  if (!recognition) initVoice();

  if (listening) {
    userRequestedOn = false;
    try {
      recognition.stop();
    } catch {}
    return false;
  } else {
    userRequestedOn = true;
    try {
      recognition.start();
    } catch {}
    return true;
  }
}

// -------------------------------
// Command handler (extended)
async function handleCommand(text) {
  const now = Date.now();

  if (
    handleCommand._last &&
    now - handleCommand._last < DEBOUNCE_MS
  ) {
    handleCommand._last = now;
    return;
  }
  handleCommand._last = now;

  try {
    // MOVEMENT
    if (text.includes("up")) {
      const pos = getSelectedPos();
      const { row, col } = pos || { row: 0, col: 0 };
      selectCell(Math.max(0, row - 1), col);
      safeSpeak("Moved up");
      const p = getSelectedPos();
      if (p) speakCellInfo(p.row, p.col);
      return;
    }

    if (text.includes("down")) {
      const pos = getSelectedPos();
      const { row, col } = pos || { row: 0, col: 0 };
      selectCell(Math.min(8, row + 1), col);
      safeSpeak("Moved down");
      const p = getSelectedPos();
      if (p) speakCellInfo(p.row, p.col);
      return;
    }

    if (text.includes("left")) {
      const pos = getSelectedPos();
      const { row, col } = pos || { row: 0, col: 0 };
      selectCell(row, Math.max(0, col - 1));
      safeSpeak("Moved left");
      const p = getSelectedPos();
      if (p) speakCellInfo(p.row, p.col);
      return;
    }

    if (text.includes("right")) {
      const pos = getSelectedPos();
      const { row, col } = pos || { row: 0, col: 0 };
      selectCell(row, Math.min(8, col + 1));
      safeSpeak("Moved right");
      const p = getSelectedPos();
      if (p) speakCellInfo(p.row, p.col);
      return;
    }

    // CLEAR CELL (single cell)
    if (
      text.includes("clear") &&
      !text.includes("clear row") &&
      !text.includes("clear column")
    ) {
      clear();
      safeSpeak("Cleared");
      const p = getSelectedPos();
      if (p) speakCellInfo(p.row, p.col);
      return;
    }

    // UNDO
    if (
      text.includes("undo") ||
      text.includes("go back one") ||
      text.includes("previous move")
    ) {
      performUndo();
      return;
    }

    // NEW GAME
    if (
      text.includes("reset") ||
      text.includes("new game") ||
      text.includes("new puzzle") ||
      text.includes("start game")
    ) {
      generatePuzzle();
      const diff = window.currentDifficulty || "medium";
      safeSpeak(`New ${diff} puzzle generated`);
      const msgEl = document.getElementById("message");
      if (msgEl) msgEl.textContent = `New ${diff} puzzle generated`;
      return;
    }

    // FEEDBACK PAGE NAVIGATION
    if (
      text.includes("feedback") ||
      text.includes("open feedback") ||
      text.includes("feedback page") ||
      text.includes("move to feedback") ||
      text.includes("go to feedback")
    ) {
      safeSpeak("Opening feedback page");
      window.location.href = "feedback.html";
      return;
    }

    // HINT
    if (text.includes("hint")) {
      document.getElementById("hintBtn")?.click();
      safeSpeak("Hint");
      return;
    }

    // SOLVE
    if (text.includes("solve")) {
      document.getElementById("solve")?.click();
      safeSpeak("Solving puzzle");
      return;
    }

    // READ / SPEAK QUERIES
    if (
      text.includes("what is here") ||
      text.includes("what is in this cell") ||
      text.includes("what is this cell") ||
      text === "what"
    ) {
      const p = getSelectedPos();
      if (p) speakCellInfo(p.row, p.col);
      else safeSpeak("No cell selected");
      return;
    }

    let m;
    m = text.match(/read row (\d{1,2})/i);
    if (m) {
      readRowOneBased(m[1]);
      return;
    }

    m =
      text.match(/read column (\d{1,2})/i) ||
      text.match(/read col(?:umn)? (\d{1,2})/i);
    if (m) {
      readColumnOneBased(m[1]);
      return;
    }

    m = text.match(/read cell(?: row)?\s*(\d{1,2})\s*(?:column|col)?\s*(\d{1,2})/i);
    if (m) {
      readCellByRowCol(m[1], m[2]);
      return;
    }

    if (text.includes("read board") || text.includes("describe board")) {
      safeSpeak("Reading entire board. This may be long.");
      readEntireBoard();
      return;
    }

    // DIFFICULTY LEVELS
    if (text.includes("difficulty") || text.includes("level") || text.includes("mode")) {
      if (text.includes("easy")) {
        setDifficulty("easy");
        return;
      }
      if (text.includes("medium")) {
        setDifficulty("medium");
        return;
      }
      if (text.includes("hard")) {
        setDifficulty("hard");
        return;
      }
    } else if (text === "easy" || text === "easy mode") {
      setDifficulty("easy");
      return;
    } else if (text === "medium" || text === "medium mode") {
      setDifficulty("medium");
      return;
    } else if (text === "hard" || text === "hard mode") {
      setDifficulty("hard");
      return;
    }

    // NUMBER INPUT (with validation)
    const n = parseNumberFromText(text);
    if (n !== null) {
      attemptInsertAtSelected(n);
      return;
    }

    // UNRECOGNIZED
    playBeep();
    announce("Unrecognized: " + text);
    safeSpeak("Command not recognized");
  } catch (e) {
    console.error("[voice] command error:", e);
    playBeep();
    safeSpeak("Command error");
  }
}
