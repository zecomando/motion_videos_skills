// Instrument library synthesised sample-by-sample in plain JS (48 kHz stereo buses): Karplus-Strong plucks and
// ukulele strums, glockenspiel, FM electric piano, supersaw stabs/pads, kick, snare, clap, hats, shaker, bass,
// risers, impacts, sub drops, whooshes, pops, clicks, shutter, squeak, whistle, brushes, upright bass, freeverb.
export const SR = 48000;
export const TAU = Math.PI * 2;
export const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
export const S = t => Math.round(t * SR);

export function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rng = mulberry32(915);
export const noise = () => rng() * 2 - 1;
export const panLR = p => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];

export class Biquad {
  constructor() { this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set('lp', 1000); }
  set(type, f, q = 0.707) {
    f = Math.min(Math.max(f, 12), SR * 0.45);
    const w = TAU * f / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
    let b0, b1, b2; const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    else { b0 = al; b1 = 0; b2 = -al; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0; return this;
  }
  p(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}

export function makeBus(N) { return { L: new Float32Array(N), R: new Float32Array(N) }; }
export function add(b, i, l, r) { if (i >= 0 && i < b.L.length) { b.L[i] += l; b.R[i] += r; } }

/* ---------- instruments (each writes into the given buses) ---------- */
// Karplus-Strong plucked nylon string
export function pluckString(bus, t0, m, g = 1, p = 0, { decay = 0.9965, bright = 0.55, dur = 1.6, send = null, sendAmt = 0.15 } = {}) {
  const f = mtof(m), n = Math.max(2, Math.round(SR / f)), line = new Float32Array(n);
  const lp = new Biquad().set('lp', 800 + 7000 * bright, 0.6);
  for (let i = 0; i < n; i++) line[i] = lp.p(noise());
  const [pl, pr] = panLR(p), i0 = S(t0), L = S(dur);
  let idx = 0, prev = 0;
  for (let k = 0; k < L; k++) {
    const cur = line[idx], nxt = line[(idx + 1) % n];
    const v = 0.5 * (cur + nxt) * decay;
    line[idx] = v; idx = (idx + 1) % n;
    const y = (cur + prev * 0.3) * g * Math.min(1, (L - k) / (SR * 0.02)); prev = cur;
    add(bus, i0 + k, y * pl, y * pr);
    if (send) add(send, i0 + k, y * sendAmt, y * sendAmt);
  }
}
// ukulele strum (re-entrant voicing), direction 'd' (low→high) or 'u'
export function strum(bus, t0, notes, g = 1, dir = 'd', opts = {}) {
  const order = dir === 'd' ? notes : [...notes].reverse();
  order.forEach((m, i) => pluckString(bus, t0 + i * (dir === 'd' ? 0.012 : 0.009), m, g * (dir === 'd' ? 1 : 0.7) * (0.85 + 0.15 * rng()), (i - 1.5) * 0.25, opts));
}
export function glock(bus, t0, m, g = 1, p = 0, send = null) {
  const f = mtof(m), [pl, pr] = panLR(p), i0 = S(t0), L = S(1.8);
  for (let k = 0; k < L; k++) {
    const t = k / SR;
    const v = (Math.sin(TAU * f * t) * Math.exp(-t * 3.2) + 0.35 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t * 9) + 0.12 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t * 16)) * Math.min(1, t / 0.0015) * g;
    add(bus, i0 + k, v * pl, v * pr); if (send) add(send, i0 + k, v * 0.25, v * 0.25);
  }
}
// breathy human whistle with vibrato and portamento from the previous note
export function whistle(bus, t0, dur, m, g = 1, { from = null, vib = 5.5, send = null } = {}) {
  const f1 = mtof(m), f0 = from != null ? mtof(from) : f1, i0 = S(t0), L = S(dur + 0.08);
  const bp = new Biquad().set('bp', f1, 6); let ph = 0;
  for (let k = 0; k < L; k++) {
    const t = k / SR, glide = Math.min(1, t / 0.06), f = (f0 + (f1 - f0) * (1 - Math.pow(1 - glide, 3))) * (1 + 0.012 * Math.sin(TAU * vib * t) * Math.min(1, t / 0.2));
    ph += TAU * f / SR;
    const env = Math.min(1, t / 0.03) * (t < dur ? 1 : Math.exp(-(t - dur) * 40));
    const v = (Math.sin(ph) + 0.06 * bp.p(noise())) * env * g;
    add(bus, i0 + k, v * 0.9, v); if (send) add(send, i0 + k, v * 0.3, v * 0.3);
  }
}
export function clap(bus, t0, g = 1, send = null) {
  const bl = new Biquad().set('bp', 1300, 0.9), br = new Biquad().set('bp', 1450, 0.9), i0 = S(t0), L = S(0.35);
  for (let k = 0; k < L; k++) {
    const t = k / SR; let e = 0; for (const o of [0, 0.009, 0.019]) if (t >= o) e = Math.max(e, Math.exp(-(t - o) * 170));
    if (t >= 0.025) e = Math.max(e, 0.5 * Math.exp(-(t - 0.025) * 18));
    const l = bl.p(noise()) * e * 3 * g, r = br.p(noise()) * e * 3 * g; add(bus, i0 + k, l, r); if (send) add(send, i0 + k, l * 0.25, r * 0.25);
  }
}
export function snap(bus, t0, g = 1, p = 0) {
  const bp = new Biquad().set('bp', 2600, 2.5), [pl, pr] = panLR(p), i0 = S(t0), L = S(0.08);
  for (let k = 0; k < L; k++) { const t = k / SR, v = (bp.p(noise()) * 4 + Math.sin(TAU * 1800 * t) * 0.3) * Math.exp(-t * 90) * g; add(bus, i0 + k, v * pl, v * pr); }
}
export function shaker(bus, t0, g = 1, p = 0) {
  const hp = new Biquad().set('hp', 6000, 0.7), [pl, pr] = panLR(p), i0 = S(t0), L = S(0.09);
  for (let k = 0; k < L; k++) { const t = k / SR, e = Math.min(1, t / 0.012) * Math.exp(-t * 45), v = hp.p(noise()) * e * g; add(bus, i0 + k, v * pl, v * pr); }
}
export function kick(bus, t0, g = 1) {
  const i0 = S(t0), L = S(0.35); let ph = 0;
  for (let k = 0; k < L; k++) { const t = k / SR, f = 50 + 90 * Math.exp(-t * 30); ph += TAU * f / SR; const v = Math.tanh(Math.sin(ph) * Math.exp(-t * 9) * 1.5) * 0.8 * g; add(bus, i0 + k, v, v); }
}
export function bass(bus, t0, dur, m, g = 1) {
  const f = mtof(m), i0 = S(t0), L = S(dur + 0.05);
  for (let k = 0; k < L; k++) {
    const t = k / SR, env = Math.min(1, t / 0.004) * (t < dur ? Math.exp(-t * 2.5) : Math.exp(-dur * 2.5) * Math.exp(-(t - dur) * 60));
    const v = (Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * 2 * f * t) * Math.exp(-t * 8)) * env * g; add(bus, i0 + k, v, v);
  }
}
// camera shutter: two mechanical clicks + a short spring rattle
export function shutter(bus, t0, g = 1, send = null) {
  const bp = new Biquad().set('bp', 3200, 1.2), hp = new Biquad().set('hp', 1500, 0.7), i0 = S(t0), L = S(0.16);
  for (let k = 0; k < L; k++) {
    const t = k / SR; let e = Math.exp(-t * 400) + (t > 0.055 ? 0.8 * Math.exp(-(t - 0.055) * 300) : 0) + 0.12 * Math.exp(-t * 40);
    const v = (bp.p(noise()) * 1.6 + hp.p(noise()) * 0.6) * e * g; add(bus, i0 + k, v, v); if (send) add(send, i0 + k, v * 0.15, v * 0.15);
  }
}
// rubber-toy squeak
export function squeak(bus, t0, g = 1, p = 0) {
  const [pl, pr] = panLR(p), i0 = S(t0), L = S(0.28); let ph = 0;
  for (let k = 0; k < L; k++) {
    const t = k / SR, f = 1300 + 900 * Math.sin(Math.PI * Math.min(1, t / 0.22)) + 60 * Math.sin(TAU * 35 * t);
    ph += TAU * f / SR;
    const e = Math.sin(Math.PI * Math.min(1, t / 0.26)) ** 0.6, v = (Math.sin(ph) + 0.3 * Math.sin(2 * ph) + 0.15 * Math.sign(Math.sin(ph))) * e * 0.5 * g;
    add(bus, i0 + k, v * pl, v * pr);
  }
}
export function whoosh(bus, tc, len = 0.6, g = 1, dir = 1) {
  const bl = new Biquad(), br = new Biquad(), i0 = S(tc - len * 0.6), L = S(len);
  for (let k = 0; k < L; k++) {
    const p = k / L, f = 400 * Math.pow(10, Math.sin(Math.PI * p));
    if (k % 16 === 0) { bl.set('bp', f, 1.2); br.set('bp', f * 1.05, 1.2); }
    const e = Math.pow(Math.sin(Math.PI * Math.pow(p, 0.8)), 2) * g, [pl, pr] = panLR(dir * (p * 2 - 1) * 0.7);
    add(bus, i0 + k, bl.p(noise()) * e * 2.2 * pl, br.p(noise()) * e * 2.2 * pr);
  }
}
export function pop(bus, t0, f = 900, g = 1, p = 0) {
  const [pl, pr] = panLR(p), i0 = S(t0), L = S(0.12); let ph = 0;
  for (let k = 0; k < L; k++) { const t = k / SR, fr = f * (1 + 0.8 * Math.exp(-t * 70)); ph += TAU * fr / SR; const v = Math.sin(ph) * Math.min(1, t / 0.001) * Math.exp(-t * 35) * g; add(bus, i0 + k, v * pl, v * pr); }
}

/* ---------- effects ---------- */
export function freeverb(src, N, room = 0.82, damp = 0.35) {
  const sc = SR / 44100, mk = len => ({ buf: new Float32Array(Math.round(len * sc)), i: 0, f: 0 });
  const CT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], AT = [556, 441, 341, 225];
  const cl = CT.map(mk), cr = CT.map(l => mk(l + 23)), al = AT.map(mk), ar = AT.map(l => mk(l + 23));
  const comb = (c, x) => { const y = c.buf[c.i]; c.f = y * (1 - damp) + c.f * damp; c.buf[c.i] = x + c.f * room; if (++c.i >= c.buf.length) c.i = 0; return y; };
  const ap = (a, x) => { const b = a.buf[a.i]; a.buf[a.i] = x + b * 0.5; if (++a.i >= a.buf.length) a.i = 0; return b - x; };
  const pre = S(0.02), L = new Float32Array(N), R = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const x = n >= pre ? (src.L[n - pre] + src.R[n - pre]) * 0.015 : 0; let l = 0, r = 0;
    for (let k = 0; k < 8; k++) { l += comb(cl[k], x); r += comb(cr[k], x); }
    for (let k = 0; k < 4; k++) { l = ap(al[k], l); r = ap(ar[k], r); }
    L[n] = l; R[n] = r;
  }
  return { L, R };
}
export function writeWav16(file, L, R, fs) {
  const N = L.length, out = Buffer.alloc(44 + N * 4);
  out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVE', 8); out.write('fmt ', 12);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40);
  for (let n = 0; n < N; n++) {
    const d = (rng() - rng()) / 32768;
    out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round((L[n] + d) * 32767))), 44 + n * 4);
    out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round((R[n] + d) * 32767))), 46 + n * 4);
  }
  fs.writeFileSync(file, out);
}

// FM electric piano (Rhodes-like): carrier + 1:1 modulator with decaying index, soft tine partial, tremolo
export function epiano(bus, t0, dur, m, g = 1, p = 0, send = null) {
  const f = mtof(m), [pl, pr] = panLR(p), i0 = S(t0), L = S(dur + 1.2); let pc = rng() * TAU, pm = 0;
  for (let k = 0; k < L; k++) {
    const t = k / SR, idx = 1.6 * Math.exp(-t * 5) + 0.25;
    pm += TAU * f / SR; pc += TAU * f / SR;
    const tine = 0.18 * Math.sin(TAU * f * 14 * t) * Math.exp(-t * 28);
    const env = Math.min(1, t / 0.004) * Math.exp(-t * 1.1) * (t < dur ? 1 : Math.exp(-(t - dur) * 8));
    const trem = 1 + 0.08 * Math.sin(TAU * 4.5 * (t0 + t));
    const v = (Math.sin(pc + idx * Math.sin(pm)) + tine) * env * g * 0.5;
    add(bus, i0 + k, v * pl * trem, v * pr * (2 - trem)); if (send) add(send, i0 + k, v * 0.2, v * 0.2);
  }
}
// jazz brush: swish (sustained filtered noise) or tap
export function brush(bus, t0, g = 1, swish = false, p = 0) {
  const bp = new Biquad().set('bp', swish ? 4200 : 3000, swish ? 0.6 : 1.1), [pl, pr] = panLR(p), i0 = S(t0), L = S(swish ? 0.4 : 0.14);
  for (let k = 0; k < L; k++) { const t = k / SR, e = swish ? Math.sin(Math.PI * Math.min(1, t / 0.4)) ** 1.5 * 0.5 : Math.exp(-t * 40), v = bp.p(noise()) * e * g * 1.4; add(bus, i0 + k, v * pl, v * pr); }
}
// upright-ish walking bass: plucked sine/triangle with thump
export function upright(bus, t0, dur, m, g = 1) {
  const f = mtof(m), i0 = S(t0), L = S(dur + 0.08), lp = new Biquad().set('lp', 700, 0.8);
  for (let k = 0; k < L; k++) {
    const t = k / SR, env = Math.min(1, t / 0.006) * Math.exp(-t * 3.2) * (t < dur ? 1 : Math.exp(-(t - dur) * 50));
    const tri = (2 / Math.PI) * Math.asin(Math.sin(TAU * f * t));
    const v = lp.p(tri * 0.7 + Math.sin(TAU * f * t) * 0.6 + (t < 0.01 ? noise() * 0.2 : 0)) * env * g; add(bus, i0 + k, v, v);
  }
}

/* ---------- electronic / trailer kit ---------- */
// detuned supersaw through a resonant low-pass sweep: stabs (short dur) or pads (long dur, slow attack)
export function supersaw(bus, t0, dur, notes, g = 1, { attack = 0.01, release = 0.25, cutoff = 2400, cutoffEnd = null, q = 0.9, detune = 0.18, voices = 5, width = 0.8, send = null, sendAmt = 0.2 } = {}) {
  const i0 = S(t0), L = S(dur + release), lpL = new Biquad(), lpR = new Biquad();
  const osc = notes.flatMap(m => Array.from({ length: voices }, (_, v) => ({ f: mtof(m) * Math.pow(2, ((v - (voices - 1) / 2) / ((voices - 1) / 2 || 1)) * detune / 12), ph: rng(), pan: ((v / Math.max(1, voices - 1)) * 2 - 1) * width })));
  const norm = 1 / Math.sqrt(osc.length);
  for (let k = 0; k < L; k++) {
    const t = k / SR;
    if (k % 32 === 0) { const c = cutoffEnd == null ? cutoff : cutoff + (cutoffEnd - cutoff) * Math.min(1, t / dur); lpL.set('lp', c, q); lpR.set('lp', c * 1.02, q); }
    const env = Math.min(1, t / attack) * (t < dur ? 1 : Math.exp(-(t - dur) / (release / 4)));
    let l = 0, r = 0;
    for (const o of osc) { o.ph += o.f / SR; if (o.ph >= 1) o.ph -= 1; const s = 2 * o.ph - 1, [pl, pr] = panLR(o.pan); l += s * pl; r += s * pr; }
    const yl = lpL.p(l * norm) * env * g, yr = lpR.p(r * norm) * env * g;
    add(bus, i0 + k, yl, yr); if (send) add(send, i0 + k, yl * sendAmt, yr * sendAmt);
  }
}
export function snare(bus, t0, g = 1, send = null) {
  const bp = new Biquad().set('bp', 1800, 0.7), hp = new Biquad().set('hp', 900, 0.7), i0 = S(t0), L = S(0.3); let ph = 0;
  for (let k = 0; k < L; k++) {
    const t = k / SR, f = 185 + 60 * Math.exp(-t * 60); ph += TAU * f / SR;
    const body = Math.sin(ph) * Math.exp(-t * 28) * 0.6, n = (bp.p(noise()) * 1.4 + hp.p(noise()) * 0.8) * Math.exp(-t * 16);
    const v = Math.tanh((body + n) * 1.3) * g; add(bus, i0 + k, v, v); if (send) add(send, i0 + k, v * 0.3, v * 0.3);
  }
}
export function hat(bus, t0, g = 1, open = false, p = 0.2) {
  const hp = new Biquad().set('hp', 7500, 0.8), bp = new Biquad().set('bp', 10000, 1.2), [pl, pr] = panLR(p), i0 = S(t0), L = S(open ? 0.35 : 0.06);
  for (let k = 0; k < L; k++) { const t = k / SR, e = Math.min(1, t / 0.001) * Math.exp(-t * (open ? 9 : 70)), x = noise(), v = (hp.p(x) * 0.7 + bp.p(x) * 0.6) * e * g; add(bus, i0 + k, v * pl, v * pr); }
}
// noise + pitch riser from t0 to t1 (ends exactly on the hit)
export function riser(bus, t0, t1, g = 1, { from = 300, to = 7000 } = {}) {
  const i0 = S(t0), L = S(t1 - t0), bl = new Biquad(), br = new Biquad(); let ph = 0;
  for (let k = 0; k < L; k++) {
    const p = k / L, f = from * Math.pow(to / from, p);
    if (k % 16 === 0) { bl.set('bp', f, 1.3); br.set('bp', f * 1.04, 1.3); }
    ph += TAU * (f / 4) / SR;
    const e = Math.pow(p, 2.2) * Math.min(1, (L - k) / (SR * 0.01)) * g, tone = Math.sin(ph) * 0.15;
    add(bus, i0 + k, (bl.p(noise()) * 2 + tone) * e, (br.p(noise()) * 2 + tone) * e);
  }
}
// cinematic hit: sub thump + noise burst + metallic ring, with a reverb send
export function impact(bus, t0, g = 1, send = null) {
  const i0 = S(t0), L = S(2.2), lp = new Biquad().set('lp', 3500, 0.7); let ph = 0;
  for (let k = 0; k < L; k++) {
    const t = k / SR, f = 38 + 70 * Math.exp(-t * 22); ph += TAU * f / SR;
    const sub = Math.sin(ph) * Math.exp(-t * 2.4), burst = lp.p(noise()) * Math.exp(-t * 14) * 0.7, ring = (Math.sin(TAU * 523 * t) * 0.08 + Math.sin(TAU * 1397 * t) * 0.05) * Math.exp(-t * 3);
    const v = Math.tanh((sub + burst + ring) * 1.4) * g; add(bus, i0 + k, v, v); if (send) add(send, i0 + k, v * 0.35, v * 0.35);
  }
}
export function subDrop(bus, t0, g = 1, dur = 2) {
  const i0 = S(t0), L = S(dur); let ph = 0;
  for (let k = 0; k < L; k++) { const t = k / SR, f = 32 + 30 * Math.exp(-t * 3); ph += TAU * f / SR; const v = Math.sin(ph) * Math.exp(-t * 1.8) * g; add(bus, i0 + k, v, v); }
}
// UI click (cursor press, toggle)
export function click(bus, t0, g = 1, p = 0) {
  const hp = new Biquad().set('hp', 2500, 0.9), [pl, pr] = panLR(p), i0 = S(t0), L = S(0.03);
  for (let k = 0; k < L; k++) { const t = k / SR, v = (hp.p(noise()) * 0.6 + Math.sin(TAU * 1900 * t) * 0.5) * Math.exp(-t * 180) * g; add(bus, i0 + k, v * pl, v * pr); }
}
