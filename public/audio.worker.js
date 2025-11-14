// audio.worker.js (optional)
// This worker is a placeholder — current system uses Web Speech API.
// If you later add model-based audio processing, use this file to offload work.

onmessage = function(e) {
  // e.data could be raw audio buffers
  // For now return a mock transcript
  postMessage({ transcript: e.data || 'simulated' });
};
