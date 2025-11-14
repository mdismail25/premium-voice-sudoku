
Voice Sudoku - Upgrades applied
==============================

Summary of changes made by assistant:
1. Frontend (public):
   - Rewrote `public/voice.js` to use continuous SpeechRecognition with interim results.
   - Added debouncing and a 'busy' lock to prevent repeated/buffered commands.
   - Added auto-restart logic to keep recognition running on flaky mobile connections.
   - Improved UI feedback via interim transcript updates in #voice-status.
   - Minimal, backward-compatible changes so existing features are preserved.

2. Backend:
   - Updated `server.js` to include CORS, JSON size limit, and a stub POST /api/recognize endpoint for future server-side ASR integration (Vosk/Whisper).
   - Added cors to package.json dependencies.

3. How to integrate a pre-trained model (recommended options):
   - Option A: Vosk (offline, server-side)
     * Install Vosk Python or Node bindings on the server.
     * Accept audio chunks (wav) at /api/recognize, save to temp file, call Vosk recognizer, return JSON transcript.
   - Option B: OpenAI Whisper (requires API/key or local heavy model)
     * Stream or upload audio and call Whisper via API or run local model.
   - Option C: Browser-first (fastest UX)
     * Keep using Web Speech API for real-time commands in modern browsers, and use server-side ASR as fallback.

4. Developer notes:
   - The front-end still uses TTS (SpeechSynthesis) for audio feedback to assist visually impaired users.
   - To support mobile apps, consider exposing a minimal REST/WebSocket endpoint for audio streaming and recognition results.
   - Included a 'stub' server API so you can plug-in any ASR model.

5. Files changed:
   - public/public/voice.js (rewritten)
   - backend/backend/server.js (updated)
   - backend/backend/package.json (added cors dependency)
   - /UPGRADES.md (this file)



## Added: Vosk ASR integration scaffold
- Added `backend/asr/recognize.py` (Python helper) that uses Vosk.
- Server now accepts base64 wav audio at POST /api/recognize and invokes the helper.
- Transcripts are appended to `backend/logs/transcripts.log`.
- See `backend/ASR_INSTRUCTIONS.txt` for install steps.


Added features implemented:
- Client-side conversion to mono 16-bit WAV and upload flow.
- WebSocket streaming endpoint (ws://.../ws/asr) for low-latency streaming.
- Whisper API scaffold at POST /api/recognize/whisper (requires OPENAI_API_KEY and multipart upload implementation).
- Confidence heuristic and confirmation UI flow on client.
