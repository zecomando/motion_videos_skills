// Soundtrack synthesised in plain JS and locked to video/cues.js: tension under the hook, a drop on the brand
// reveal, a groove that stays sparse under the voice, a lift on the CTA, and sound design on every cut and UI moment.
// It is a BED for the voice-over (mux.mjs ducks it). Output: out/music.wav (48 kHz stereo).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import * as X from './synth.mjs';

const C = createRequire(import.meta.url)('./video/cues.js');
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const { S } = X;
const N = S(C.duration);
const band = X.makeBus(N), lead = X.makeBus(N), drums = X.makeBus(N), sfx = X.makeBus(N), rv = X.makeBus(N);
const beat = 60 / (C.bpm || 120), bar = 4 * beat, DROP = C.brand.start, CTA = C.cta.start, END = C.duration;

// I–V–vi–IV in D (MIDI): electric-piano voicing, pluck arpeggio notes, bass root
const PROG = [
  { ep: [50, 57, 64, 66], pl: [74, 78, 81, 85], root: 38 },
  { ep: [52, 57, 61, 64], pl: [73, 76, 81, 85], root: 33 },
  { ep: [54, 57, 62, 66], pl: [74, 78, 83, 86], root: 35 },
  { ep: [55, 59, 62, 66], pl: [74, 79, 83, 86], root: 31 },
];

// 1 · hook: ticking pulse + riser into the brand drop
for (let t = beat / 2; t < DROP - 0.1; t += beat / 2) X.shaker(drums, t, 0.15 + 0.08 * (t / DROP), t % beat ? 0.35 : -0.35);
for (let t = beat; t < DROP - 0.1; t += beat / 2) X.pluckString(band, t, [59, 66, 59, 64][Math.round(t / (beat / 2)) % 4], 0.16, 0.1, { decay: 0.985, dur: 0.25, bright: 0.35 });
X.riser(sfx, DROP - 1.2, DROP, 0.5);

// 2 · drop on the brand
X.impact(drums, DROP, 0.7, rv); X.subDrop(sfx, DROP, 0.3);
PROG[0].ep.forEach((m, i) => X.epiano(band, DROP, 1.8, m, 0.42, (i - 1.5) * 0.3, rv));
[81, 85, 88, 90, 93].forEach((m, i) => X.glock(sfx, C.brand.logo + 0.4 + i * 0.09, m, 0.2, (i - 2) * 0.3, rv));

// 3 · groove (lighter under the voice, fuller at the CTA)
for (let k = 0; DROP + bar + k * bar < END - 1; k++) {
  const t = DROP + bar + k * bar, ch = PROG[(k + 1) % 4], full = t >= CTA;
  ch.ep.forEach((m, i) => X.epiano(band, t, bar * 0.85, m, full ? 0.42 : 0.34, (i - 1.5) * 0.3, rv));
  for (let b = 0; b < 4; b++) {
    const tb = t + b * beat; if (tb >= END - 1) break;
    X.kick(drums, tb, full ? 0.32 : 0.24);
    if (b % 2) X.clap(drums, tb, full ? 0.42 : 0.3, rv);
    X.hat(drums, tb + beat / 2, 0.18);
    X.bass(band, tb + (b % 2 ? beat / 2 : 0), beat * 0.45, ch.root + (b === 3 ? 12 : 0), 0.3);
  }
  [0, 2, 1, 3, 2, 1, 3, 2].forEach((n, s) => { if (full || !(s % 2)) X.pluckString(lead, t + s * beat / 2, ch.pl[n], full ? 0.3 : 0.24, s % 2 ? 0.35 : -0.35, { decay: 0.993, dur: 0.5, send: rv, sendAmt: 0.25 }); });
}
PROG[0].ep.concat([69, 74]).forEach((m, i) => X.epiano(band, END - 1.0, 1.0, m, 0.24, (i - 2.5) * 0.25, rv));

// 4 · sound design on cuts and UI moments
[C.brand.start, C.cta.start].forEach((t, i) => X.whoosh(sfx, t, 0.6, 0.35, i % 2 ? -1 : 1));
X.pop(sfx, C.cta.button, 1000, 0.16, 0); X.click(sfx, C.cta.click, 0.5); X.glock(sfx, C.cta.click + 0.05, 93, 0.2, 0, rv);

/* ---------- mix: sum, soft-clip, fade out, dithered 16-bit ---------- */
const rvb = X.freeverb(rv, N, 0.8, 0.4);
const L = new Float32Array(N), R = new Float32Array(N);
const hp = [new X.Biquad().set('hp', 30, 0.7), new X.Biquad().set('hp', 30, 0.7)];
const G = { band: 1.0, lead: 0.9, drums: 0.8, sfx: 0.8, rv: 2.0 };
for (let n = 0; n < N; n++) {
  L[n] = hp[0].p(band.L[n] * G.band + lead.L[n] * G.lead + drums.L[n] * G.drums + sfx.L[n] * G.sfx + rvb.L[n] * G.rv);
  R[n] = hp[1].p(band.R[n] * G.band + lead.R[n] * G.lead + drums.R[n] * G.drums + sfx.R[n] * G.sfx + rvb.R[n] * G.rv);
}
let pk = 1e-9; for (let n = 0; n < N; n++) pk = Math.max(pk, Math.abs(L[n]), Math.abs(R[n]));
let pk2 = 1e-9; for (let n = 0; n < N; n++) { L[n] = Math.tanh(L[n] / pk * 1.3); R[n] = Math.tanh(R[n] / pk * 1.3); pk2 = Math.max(pk2, Math.abs(L[n]), Math.abs(R[n])); }
const fo = S(C.cta.fade);
for (let n = 0; n < N; n++) { const g = n < fo ? 1 : 0.5 + 0.5 * Math.cos(Math.PI * (n - fo) / (N - fo)), fi = Math.min(1, n / S(0.05)); L[n] = L[n] / pk2 * 0.89 * g * fi; R[n] = R[n] / pk2 * 0.89 * g * fi; }
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
X.writeWav16(path.join(ROOT, 'out', 'music.wav'), L, R, fs);
console.log('music -> out/music.wav', C.duration + ' s');
