// voice.js — deterministic single-worker strategy: stop-on-final, process one transcript, restart after done.
// Replaces previous voice.js to stabilize repeated commands bursts.
import { insert, selectCell, clear, generatePuzzle, speak as ttsSpeak, announce, selected } from './sudoku.js';

let recognition = null;
let listening = false;
let processing = false;
let userRequestedOn = false;
let lastTranscript = '';
let lastTranscriptAt = 0;

const DEBOUNCE_MS = 1200;
const DUPLICATE_WINDOW_MS = 2500;
const RESTART_DELAY_MS = 400;
const NUMBER_WORDS = {'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9};

function similarEnough(a,b){
  if(!a||!b) return false;
  if(a === b) return true;
  if(a.includes(b) || b.includes(a)) return true;
  if(Math.abs(a.length - b.length) <= 2){
    let diff = 0;
    const L = Math.min(a.length, b.length);
    for(let i=0;i<L;i++) if(a[i]!==b[i]) diff++;
    diff += Math.abs(a.length - b.length);
    return diff <= 2;
  }
  return false;
}

function parseNumberFromText(text) {
  const numMatch = text.match(/\b([1-9])\b/);
  if (numMatch) return parseInt(numMatch[1],10);
  for (const [w,n] of Object.entries(NUMBER_WORDS)) if (text.includes(w)) return n;
  return null;
}

export function initVoice(){
  if (recognition) return;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition){
    const el = document.getElementById('voice-status');
    if (el) el.textContent = 'SpeechRecognition not supported';
    return;
  }
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    listening = true;
    const btn = document.getElementById('listen');
    if (btn) btn.setAttribute('aria-pressed','true');
    const vs = document.getElementById('voice-status');
    if (vs) vs.textContent = '🎙️ Listening...';
    console.log('[voice] onstart');
  };

  recognition.onend = () => {
    listening = false;
    const btn = document.getElementById('listen');
    if (btn) btn.setAttribute('aria-pressed','false');
    const vs = document.getElementById('voice-status');
    if (vs) vs.textContent = userRequestedOn ? 'Click to resume' : 'Not listening';
    console.log('[voice] onend; userRequestedOn=', userRequestedOn, 'processing=', processing);
    if(userRequestedOn && !processing){
      setTimeout(() => {
        try { recognition.start(); console.log('[voice] restarted after end'); }
        catch(e){ console.warn('[voice] restart failed', e); }
      }, 300);
    }
  };

  recognition.onerror = (e) => {
    console.error('[voice] error', e);
    const vs = document.getElementById('voice-status');
    if (vs) vs.textContent = 'Voice error';
  };

  recognition.onresult = async (evt) => {
    let interim = '', final = '';
    for (let i = evt.resultIndex; i < evt.results.length; ++i){
      const r = evt.results[i];
      if (r.isFinal) final += r[0].transcript + ' ';
      else interim += r[0].transcript + ' ';
    }
    interim = interim.trim();
    final = final.trim();

    if(interim){
      const vs = document.getElementById('voice-status');
      if(vs) vs.textContent = '📝 ' + interim;
    }

    if(final){
      const transcript = final.toLowerCase().trim();
      if(!transcript) return;
      console.log('[voice] final received:', transcript);

      if(processing){
        console.log('[voice] dropped because processing active:', transcript);
        return;
      }

      const now = Date.now();
      if(similarEnough(transcript, lastTranscript) && (now - lastTranscriptAt) < DUPLICATE_WINDOW_MS){
        console.log('[voice] suppressed similar duplicate transcript:', transcript);
        return;
      }

      const words = transcript.split(/\s+/).filter(Boolean);
      const isSingleNumber = (/^\d$/.test(transcript) || Object.keys(NUMBER_WORDS).includes(transcript));
      const knownShort = ['up','down','left','right','clear','delete','remove','solve','reset','new','start'];
      const isKnownShort = words.length === 1 && knownShort.includes(transcript);

      if(words.length === 1 && !isSingleNumber && !isKnownShort){
        console.log('[voice] ignored 1-word non-command final:', transcript);
        const evtConfirm = new CustomEvent('voice:ambiguous', { detail: { transcript } });
        window.dispatchEvent(evtConfirm);
        return;
      }

      processing = true;
      try { recognition.stop(); } catch(e){ console.warn('[voice] stop failed', e); }

      announce(`Heard: ${transcript}`);
      lastTranscript = transcript;
      lastTranscriptAt = now;

      await handleFinalTranscript(transcript);

      processing = false;
      setTimeout(() => {
        if(userRequestedOn){
          try { recognition.start(); console.log('[voice] restart after processing'); }
          catch(e){ console.warn('[voice] restart after processing failed', e); }
        }
      }, RESTART_DELAY_MS);
    }
  };
}

export function toggleVoice(){
  if(!recognition) initVoice();
  const btn = document.getElementById('listen');
  if(!recognition || !btn) return;
  if(listening){
    userRequestedOn = false;
    try { recognition.stop(); } catch(e){ console.warn('[voice] toggle stop failed', e); }
    console.log('[voice] user toggled OFF');
  } else {
    userRequestedOn = true;
    try { recognition.start(); } catch(e){ console.warn('[voice] toggle start failed', e); }
    console.log('[voice] user toggled ON');
  }
}

async function handleFinalTranscript(transcript){
  const now = Date.now();
  if(handleFinalTranscript._lastHandledAt && (now - handleFinalTranscript._lastHandledAt) < DEBOUNCE_MS){
    console.log('[voice] global debounce prevented action:', transcript);
    handleFinalTranscript._lastHandledAt = now;
    return;
  }
  handleFinalTranscript._lastHandledAt = now;

  try {
    if(transcript.includes('up')){ const {row,col}=selected; selectCell(Math.max(0,row-1),col); ttsSpeak('Moved up'); return; }
    if(transcript.includes('down')){ const {row,col}=selected; selectCell(Math.min(8,row+1),col); ttsSpeak('Moved down'); return; }
    if(transcript.includes('left')){ const {row,col}=selected; selectCell(row,Math.max(0,col-1)); ttsSpeak('Moved left'); return; }
    if(transcript.includes('right')){ const {row,col}=selected; selectCell(row,Math.min(8,col+1)); ttsSpeak('Moved right'); return; }
    if(transcript.includes('clear')||transcript.includes('delete')||transcript.includes('remove')){ clear(); ttsSpeak('Cleared cell'); return; }
    if(transcript.includes('new game')||transcript.includes('new puzzle')||transcript.includes('reset')){ generatePuzzle(); ttsSpeak('New puzzle generated'); return; }
    if(transcript.includes('solve')){ const solveBtn = document.getElementById('solve'); if(solveBtn) solveBtn.click(); ttsSpeak('Solving puzzle'); return; }
    const n = parseNumberFromText(transcript); if(n !== null){ insert(n); return; }
    announce(`Unrecognized: ${transcript}`); ttsSpeak('Command not recognized');
  } catch(e){
    console.error('[voice] handling transcript failed', e);
  }
}

export { parseNumberFromText };
