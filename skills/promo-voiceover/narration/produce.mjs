// VO production. Each vo.json group (a scene) is read in ONE take so the performance flows; N takes per group.
// Every take is transcribed and must contain every scripted word (WER gate, required brand terms); with
// GEMINI_API_KEY the takes are also scored by an AI ear. The best valid take is cut into one file per line
// at the real silences of the audio (STT word times trail the audio, so they are lag-corrected and only used
// to pick WHICH silence), then every exported phrase is transcribed again on its own.
//   node --env-file=narration/.env narration/produce.mjs [--takes 3] [--regroup g2,g5]
//   -> narration/phrases/<voice>/<line>.wav + narration/phrases.json (durations, display-word onsets)
import fs from 'fs';
import path from 'path';
import { VO, LANG, ALIASES, DIR, ROOT, PAUSE, state, ttsArgs, applyPron, fmt } from './common.mjs';
import { tts, hear, judge, pool, has, JUDGES } from './providers.mjs';
import { wer, missing, norm, applyAliases, timedWords, alignWords, displayOnsets, syllables } from './text.mjs';
import { readWav, writeWav, envelope, tighten, remap, analyse, articulation } from './wav.mjs';

const args = process.argv.slice(2), arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const VOICE = VO.voice;
if (!VOICE) { console.error('set "voice" in narration/vo.json first (cast.mjs)'); process.exit(1); }
const vkey = String(VOICE).replace(/[^\w-]+/g, '_');
const TAKES = Number(arg('--takes', VO.takes || 3));
const TK = path.join(DIR, 'takes', vkey), PH = path.join(DIR, 'phrases', vkey);
fs.mkdirSync(TK, { recursive: true }); fs.mkdirSync(PH, { recursive: true });
const { s: ALL, save } = state('production.json');
const S = (ALL[vkey] ??= {});
const EAR = has('GEMINI_API_KEY') && VO.judgeTakes !== false ? (VO.judges || JUDGES)[0] : null;
const redo = new Set((arg('--regroup', '') || '').split(',').filter(Boolean));
const tokensOf = s => applyAliases(norm(s, LANG), ALIASES).split(' ').filter(Boolean);

const G = VO.groups.map(g => ({ ...g, style: g.style || VO.style, ttsText: g.lines.map(l => applyPron(l.tts || l.text)).join(PAUSE), ref: g.lines.map(l => l.text).join(' ') }));
const required = (VO.required || []).map(r => applyAliases(norm(r, LANG), ALIASES));

const TAKE_RUBRIC = { type: 'OBJECT', properties: { transcript: { type: 'STRING' }, native_accent: { type: 'NUMBER' }, energy: { type: 'NUMBER' }, naturalness: { type: 'NUMBER' }, delivery_fit: { type: 'NUMBER' }, pronunciation_issues: { type: 'STRING' }, artifacts: { type: 'STRING' }, overall: { type: 'NUMBER' } }, required: ['transcript', 'native_accent', 'energy', 'naturalness', 'delivery_fit', 'pronunciation_issues', 'artifacts', 'overall'] };

// 1) takes
const jobs = G.flatMap(g => Array.from({ length: TAKES }, (_, k) => ({ g, k })));
for (const g of G) if (redo.has(g.id)) for (const id of Object.keys(S).filter(id => S[id].group === g.id)) { fs.rmSync(path.join(TK, S[id].file), { force: true }); delete S[id]; }
await pool(jobs, VO.provider === 'soniox' ? 3 : 4, async ({ g, k }) => {
  const id = `${g.id}_t${k}`, f = path.join(TK, id + '.wav');
  if (S[id] && S[id].ttsText !== g.ttsText) { fs.rmSync(f, { force: true }); delete S[id]; } // script changed
  if (!fs.existsSync(f)) fs.writeFileSync(f, await tts(ttsArgs(g.ttsText, g.style, VOICE)));
  const tk = (S[id] ??= { group: g.id, k, file: path.basename(f), ttsText: g.ttsText });
  const wav = fs.readFileSync(f);
  if (!tk.stt) { tk.stt = await hear(wav, LANG); save(); }
  const a = analyse(wav), heardN = applyAliases(norm(tk.stt.text, LANG), ALIASES);
  Object.assign(tk, { heard: tk.stt.text, wer: +wer(g.ref, tk.stt.text, LANG, ALIASES).toFixed(3), missing: missing(g.ref, tk.stt.text, LANG, ALIASES),
    reqOk: required.filter(r => applyAliases(norm(g.ref, LANG), ALIASES).includes(r)).every(r => heardN.includes(r)), dur: +a.duration.toFixed(2), speech: +a.speech.toFixed(2), movement: a.f0.movement,
    rate: +(syllables(g.ref, LANG) / articulation(wav)).toFixed(2) }); // syllables per second of talking
  if (EAR && !tk.ear) {
    tk.ear = await judge({ model: EAR, clips: [{ label: 'A', wav }], schema: TAKE_RUBRIC,
      prompt: `One take of a ${LANG} voice-over for this commercial: ${VO.brief}\nIntended words: "${g.ref}". Intended delivery: ${g.style}.\nTranscribe exactly what is said, then score 0-10 (strict): native_accent (${LANG}), energy, naturalness (human, no odd prosody), delivery_fit (matches the intended delivery and the line's role in the ad). List pronunciation_issues and artifacts (or "none"). overall = would you approve this take for broadcast?` });
  }
  save();
});

// 2) choose per group: valid takes first; then AI-ear quality, pace (syllables/s of talking above maxRate is penalised:
//    a Gemini pt-PT take at ~7 syl/s sounded rushed), typical length, liveliness
const MAX_RATE = VO.maxRate ?? (/^pt/i.test(LANG) ? 5.5 : 5.0);
const chosen = {}, ranked = {};
for (const g of G) {
  const takes = Object.values(S).filter(t => t.group === g.id && t.stt);
  const valid = takes.filter(t => t.wer <= (VO.maxWer ?? 0) && t.reqOk);
  const from = valid.length ? valid : takes;
  const med = from.map(t => t.dur).sort((a, b) => a - b)[Math.floor(from.length / 2)];
  const score = t => (t.ear ? 0.4 * t.ear.overall + 0.2 * t.ear.native_accent + 0.2 * t.ear.naturalness + 0.2 * t.ear.delivery_fit - (t.ear.native_accent < 7 ? 3 : 0) : 0) - 1.5 * Math.abs(t.dur - med) + 2 * t.movement - 2 * Math.max(0, (t.rate ?? 0) - MAX_RATE);
  ranked[g.id] = from.sort((a, b) => score(b) - score(a));
  chosen[g.id] = ranked[g.id][0];
  const c = chosen[g.id];
  console.log(`${g.id} ${valid.length}/${takes.length} valid -> ${c.file} ${c.dur}s ${c.rate} syl/s${c.ear ? ` ear ${c.ear.overall}/${c.ear.native_accent}` : ''} | ${c.heard}   [${takes.map(t => t.file.replace('.wav', '') + ' ' + t.rate).join(', ')}]`);
  if (!valid.length) console.log(`   !! no take has every word — best missing: ${c.missing.join(', ')} (rewrite the line or add takes)`);
  takes.filter(t => !valid.includes(t)).forEach(t => console.log(`     x ${t.file} wer=${t.wer} req=${t.reqOk} missing=[${t.missing.join(' ')}]`));
}

// 3) cut a take into one file per line at real silences
function cutTake(g, c) {
  const { sr, x } = readWav(fs.readFileSync(path.join(TK, c.file)));
  const E = envelope(x, sr, VO.silenceRel ?? 0.03), ET = envelope(x, sr, VO.trimRel ?? 0.012);
  const tw = timedWords(c.stt.tokens), lag = tw.length ? Math.max(0, tw[0].s - E.onset) : 0;
  const aligned = tw.length ? alignWords(g.ref, tw.map(w => ({ ...w, s: w.s - lag, e: w.e - lag })), LANG, ALIASES) : null;
  const counts = g.lines.map(l => tokensOf(l.text).length);
  const cuts = [0];
  if (aligned) {
    let acc = 0;
    for (let i = 0; i < g.lines.length - 1; i++) {
      acc += counts[i];
      const est = (aligned[acc - 1].e + aligned[acc].s) / 2;
      const best = E.gaps.filter(gp => gp.len >= 0.06).map(gp => ({ gp, d: Math.abs((gp.a + gp.b) / 2 - est) })).sort((p, q) => p.d - q.d)[0];
      cuts.push(best && best.d < 0.6 ? (best.gp.a + best.gp.b) / 2 : est);
    }
  } else { // no word timings: the (lines-1) longest silences, in time order
    E.gaps.slice().sort((p, q) => q.len - p.len).slice(0, g.lines.length - 1).sort((p, q) => p.a - q.a).forEach(gp => cuts.push((gp.a + gp.b) / 2));
  }
  cuts.push(x.length / sr);
  const out = {};
  let wi = 0;
  g.lines.forEach((l, li) => {
    const A = cuts[li], B = cuts[li + 1];
    // trim with a lower threshold than the gap finder so soft word tails survive (pt-PT final vowels are often whispered)
    let s0 = Math.floor(A / 0.01), s1 = Math.min(ET.n, Math.ceil(B / 0.01));
    while (s0 < s1 && !ET.loud(s0)) s0++;
    while (s1 > s0 && !ET.loud(s1 - 1)) s1--;
    const a = Math.max(A, s0 * 0.01 - (VO.padIn ?? 0.04)), b = Math.min(B, s1 * 0.01 + (VO.padOut ?? 0.14));
    let seg = Float32Array.from(x.subarray(Math.floor(a * sr), Math.floor(b * sr))), removed = [];
    if (VO.maxPause) { const tg = tighten(seg, sr, { maxPause: VO.maxPause, keep: VO.keepPause ?? 0.24 }); if (tg.saved) { removed = tg.cuts; seg = tg.x; } }
    const fl = Math.round(sr * 0.008); for (let i = 0; i < fl; i++) { seg[i] *= i / fl; seg[seg.length - 1 - i] *= i / fl; }
    const file = path.join(PH, `${l.id}.wav`); fs.writeFileSync(file, writeWav(sr, seg));
    const mine = aligned ? aligned.slice(wi, wi + counts[li]) : [];
    const on = aligned ? displayOnsets(l.text, mine, LANG).map(t => Math.max(0, remap(t - a, removed))) : [];
    const words = String(l.text).split(/\s+/).filter(Boolean).map((w, i) => ({ w, s: +(on[i] ?? 0).toFixed(3) }));
    out[l.id] = { file: path.relative(ROOT, file).replace(/\\/g, '/'), dur: +(seg.length / sr).toFixed(3), text: l.text, group: g.id, take: c.file, lag: +lag.toFixed(3), words, timed: !!aligned, removed };
    wi += counts[li];
  });
  return out;
}
// 4) every phrase on its own must still contain all its words ("sistema testado" was heard as "sistema de estado"
//    alone although the whole take passed): if a phrase fails, the next valid take of the group is cut and tried
async function verify(out) {
  await pool(Object.entries(out), VO.provider === 'soniox' ? 3 : 4, async ([id, p]) => {
    const r = await hear(fs.readFileSync(path.join(ROOT, p.file)), LANG);
    p.heard = r.text; p.wer = +wer(p.text, r.text, LANG, ALIASES).toFixed(3); p.missing = missing(p.text, r.text, LANG, ALIASES);
  });
  return Object.values(out).reduce((s, p) => s + p.missing.length + (p.wer > 0 ? 0.5 : 0), 0);
}
const phrases = {};
for (const g of G) {
  let best = null, bestBad = Infinity, last = null;
  for (const c of ranked[g.id].slice(0, VO.phraseTries ?? 3)) {
    const out = cutTake(g, c); last = c;
    const bad = await verify(out);
    if (bad < bestBad) { best = { c, out }; bestBad = bad; }
    if (!bad) break;
    console.log(`   ${g.id}: ${c.file} fails line by line (${Object.values(out).filter(p => p.wer > 0).map(p => `"${p.heard}"`).join(', ')}), trying the next take`);
  }
  if (best.c !== last) { const again = cutTake(g, best.c); for (const id of Object.keys(again)) Object.assign(again[id], { heard: best.out[id].heard, wer: best.out[id].wer, missing: best.out[id].missing }); best.out = again; }
  Object.assign(phrases, best.out);
}
fs.writeFileSync(path.join(DIR, 'phrases.json'), JSON.stringify({ voice: VOICE, language: LANG, phrases }, null, 1));
console.log('\nphrases -> narration/phrases.json');
Object.entries(phrases).forEach(([k, p]) => console.log(`  ${p.wer === 0 ? 'OK' : '!!'} ${k} ${fmt(p.dur)}s ${p.take}  heard: ${p.heard}${p.missing.length ? '   missing: ' + p.missing.join(' ') : ''}`));
