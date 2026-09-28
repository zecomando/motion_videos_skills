// WAV I/O and objective voice measurements in plain JS (no dependencies).
export function readWav(buf) {
  let p = 12, fmt, data;
  while (p < buf.length - 8) {
    const id = buf.toString('ascii', p, p + 4), size = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { ch: buf.readUInt16LE(p + 10), sr: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22) };
    if (id === 'data') { data = buf.subarray(p + 8, Math.min(buf.length, p + 8 + size)); break; }
    p += 8 + size + (size & 1);
  }
  if (!fmt || !data || fmt.bits !== 16) throw new Error('expected 16-bit PCM WAV');
  const n = Math.floor(data.length / 2 / fmt.ch), x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = data.readInt16LE(i * 2 * fmt.ch) / 32768; // first channel
  return { sr: fmt.sr, x };
}
export function writeWav(sr, x) {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  return b;
}
export const duration = buf => { const { sr, x } = readWav(buf); return x.length / sr; };

// 10 ms RMS envelope, silent runs between sounds, first/last sound
export function envelope(x, sr, rel = 0.03) {
  const win = Math.round(sr * 0.01), n = Math.floor(x.length / win), env = new Float32Array(n);
  let pk = 0;
  for (let w = 0; w < n; w++) { let s = 0; for (let k = w * win; k < (w + 1) * win; k++) s += x[k] * x[k]; env[w] = Math.sqrt(s / win); pk = Math.max(pk, env[w]); }
  const loud = w => env[w] >= pk * rel;
  const gaps = [];
  for (let w = 0; w < n;) { if (loud(w)) { w++; continue; } let e = w; while (e < n && !loud(e)) e++; if (w > 0 && e < n) gaps.push({ a: w * 0.01, b: e * 0.01, len: (e - w) * 0.01 }); w = e; }
  let first = 0; while (first < n && !loud(first)) first++;
  let last = n - 1; while (last > 0 && !loud(last)) last--;
  return { env, loud, gaps, onset: first * 0.01, offset: (last + 1) * 0.01, n };
}

// Shorten interior pauses longer than maxPause to `keep` seconds (removes the middle, 12 ms crossfades)
export function tighten(x, sr, { maxPause = 0.3, keep = 0.24, rel = 0.03, xfade = 0.012 } = {}) {
  const { gaps } = envelope(x, sr, rel);
  const cuts = gaps.filter(g => g.len > maxPause).map(g => { const mid = (g.a + g.b) / 2, half = (g.len - keep) / 2; return [Math.round((mid - half) * sr), Math.round((mid + half) * sr)]; });
  if (!cuts.length) return { x, saved: 0, cuts: [] };
  const xf = Math.round(xfade * sr), out = [];
  let pos = 0;
  const push = seg => { if (out.length && seg.length > xf) { for (let i = 0; i < xf; i++) { const t = i / xf; out[out.length - xf + i] = out[out.length - xf + i] * (1 - t) + seg[i] * t; } for (let i = xf; i < seg.length; i++) out.push(seg[i]); } else for (const v of seg) out.push(v); };
  for (const [c0, c1] of cuts) { push(x.subarray(pos, c0)); pos = c1; }
  push(x.subarray(pos));
  // removed intervals in seconds (input time) so word times can be remapped
  return { x: Float32Array.from(out), saved: cuts.reduce((s, [a, b]) => s + (b - a), 0) / sr, cuts: cuts.map(([a, b]) => [a / sr, (b + xf) / sr]) };
}
// time in the input -> time after tighten() removed `cuts`
export const remap = (t, cuts = []) => t - cuts.reduce((acc, [c0, c1]) => acc + Math.max(0, Math.min(t, c1) - c0), 0);

const pct = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))] : 0; };
// speech time, pauses, pitch (autocorrelation F0): median Hz, range and movement in semitones (liveliness proxy)
export function analyse(buf) {
  const { sr, x } = readWav(buf);
  const dec = Math.max(1, Math.round(sr / 16000)), fs = sr / dec, y = new Float32Array(Math.floor(x.length / dec));
  for (let i = 0; i < y.length; i++) { let s = 0; for (let k = 0; k < dec; k++) s += x[i * dec + k]; y[i] = s / dec; }
  const hop = Math.round(fs * 0.01), win = Math.round(fs * 0.04), frames = Math.max(0, Math.floor((y.length - win) / hop));
  const rms = new Float32Array(frames); let peak = 0;
  for (let f = 0; f < frames; f++) { let s = 0; for (let i = 0; i < win; i++) { const v = y[f * hop + i]; s += v * v; } rms[f] = Math.sqrt(s / win); peak = Math.max(peak, rms[f]); }
  const thr = peak * 0.06, minLag = Math.floor(fs / 320), maxLag = Math.ceil(fs / 65), f0s = [];
  for (let f = 0; f < frames; f++) {
    if (rms[f] < thr * 2) continue;
    const o = f * hop; let best = 0, bestLag = 0, e0 = 0;
    for (let i = 0; i < win; i++) e0 += y[o + i] * y[o + i];
    for (let lag = minLag; lag <= maxLag; lag++) {
      let c = 0, e1 = 0;
      for (let i = 0; i < win - lag; i++) { c += y[o + i] * y[o + i + lag]; e1 += y[o + i + lag] * y[o + i + lag]; }
      const r = c / Math.sqrt(e0 * e1 + 1e-12);
      if (r > best) { best = r; bestLag = lag; }
    }
    if (best > 0.55) f0s.push(fs / bestLag);
  }
  let speech = 0, pauses = 0, run = 0;
  for (let f = 0; f < frames; f++) { if (rms[f] >= thr) { if (run * 0.01 >= 0.25 && speech > 0) pauses++; run = 0; speech++; } else run++; }
  const st = f0s.map(f => 12 * Math.log2(f / 100));
  let mv = 0; for (let i = 1; i < st.length; i++) mv += Math.min(3, Math.abs(st[i] - st[i - 1]));
  return { duration: x.length / sr, speech: speech * 0.01, pauses, f0: { median: Math.round(pct(f0s, 0.5)), range: +(pct(st, 0.9) - pct(st, 0.1)).toFixed(1), movement: +(mv / Math.max(1, st.length - 1)).toFixed(3) } };
}

// seconds of actual talking: first to last sound, minus pauses longer than minPause (pace = syllables / articulation)
export function articulation(buf, { minPause = 0.25, rel = 0.03 } = {}) {
  const { sr, x } = readWav(buf), E = envelope(x, sr, rel);
  return Math.max(0.1, E.offset - E.onset - E.gaps.filter(g => g.len > minPause).reduce((a, g) => a + g.len, 0));
}
