// Single source of timing for picture, voice and music. Loaded by the page (window.CUES) and by the Node
// scripts (render, audio, mux, narration/assemble). Scene times follow the voice: see narration/assemble.mjs --suggest.
var CUES = {
  name: 'brand-promo', width: 1920, height: 1080, fps: 60, duration: 30, bpm: 120,
  vo: { v01: 0.6, v02: 2.4, v03: 6.2, v04: 25.4, v05: 27.2 },
  hook: { start: 0, impact: 5.0 },
  brand: { start: 5.0, logo: 5.1, tagline: 6.2 },
  cta: { start: 25.0, button: 26.2, click: 27.4, url: 27.2, fade: 29.3 },
  mix: { music: -19.5, voice: -15.5 },
};
if (typeof module !== 'undefined') module.exports = CUES;
