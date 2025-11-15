// voice.js — deterministic stable voice engine with restart-safety.
// Fully integrated with main.js + sudoku.js + solver.worker.js.

import {
  insert,
  selectCell,
  clear,
  generatePuzzle,
  speak as ttsSpeak,
  announce,
  selected
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
  recognition.interimResults = true;
  recognition.lang = "en-US";
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    listening = true;
    document
      .getElementById("listen")
      ?.setAttribute("aria-pressed", "true");
    const vs = document.getElementById("voice-status");
    if (vs) vs.textContent = "🎙️ Listening...";
  };

  recognition.onend = () => {
    listening = false;
    document
      .getElementById("listen")
      ?.setAttribute("aria-pressed", "false");

    const vs = document.getElementById("voice-status");
    if (vs) vs.textContent = userRequestedOn
      ? "Click to resume"
      : "Not listening";

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

    if (interim) {
      const vs = document.getElementById("voice-status");
      if (vs) vs.textContent = "📝 " + interim;
    }

    if (!final) return;

    const transcript = final.toLowerCase().trim();
    if (!transcript) return;

    console.log("[voice] final:", transcript);

    if (processing) return;

    const now = Date.now();

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
      const { row, col } = selected;
      selectCell(Math.max(0, row - 1), col);
      ttsSpeak("Moved up");
      return;
    }

    if (text.includes("down")) {
      const { row, col } = selected;
      selectCell(Math.min(8, row + 1), col);
      ttsSpeak("Moved down");
      return;
    }

    if (text.includes("left")) {
      const { row, col } = selected;
      selectCell(row, Math.max(0, col - 1));
      ttsSpeak("Moved left");
      return;
    }

    if (text.includes("right")) {
      const { row, col } = selected;
      selectCell(row, Math.min(8, col + 1));
      ttsSpeak("Moved right");
      return;
    }

    // CLEAR
    if (
      text.includes("clear") ||
      text.includes("remove") ||
      text.includes("delete")
    ) {
      clear();
      ttsSpeak("Cleared");
      return;
    }

    // NEW GAME
    if (
      text.includes("reset") ||
      text.includes("new game") ||
      text.includes("new puzzle") ||
      text.includes("start")
    ) {
      generatePuzzle();
      ttsSpeak("New puzzle generated");
      return;
    }

    // SOLVE
    if (text.includes("solve")) {
      // prefer calling helper directly if present
      if (typeof window.solvePuzzle === 'function') {
        window.solvePuzzle();
      } else {
        document.getElementById("solve")?.click();
      }
      ttsSpeak("Solving puzzle");
      return;
    }

    // HINT
    if (text.includes("hint")) {
      if (typeof window.requestHint === 'function') {
        window.requestHint();
      } else {
        document.getElementById("hintBtn")?.click();
      }
      ttsSpeak("Hint");
      return;
    }

    // NUMBER INPUT
    const n = parseNumberFromText(text);
    if (n !== null) {
      insert(n);
      return;
    }

    // UNRECOGNIZED
    announce("Unrecognized: " + text);
    ttsSpeak("Command not recognized");
  } catch (e) {
    console.error("[voice] command error:", e);
  }
}
