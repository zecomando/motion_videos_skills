// Voice casting. Every candidate reads the same audition copy (vo.json casting.text) N times; each take is
// transcribed (exact words), measured (pace, pitch movement) and, when GEMINI_API_KEY is set, scored by two
// independent AI "ears" against the brief. Native accent is a gate (pt-PT: European Portuguese phonology).
//   node --env-file=narration/.env narration/cast.mjs                 # audition + ranking
//   node --env-file=narration/.env narration/cast.mjs --final 5       # + order-robust side-by-side final (Borda)
//   node --env-file=narration/.env narration/cast.mjs --final-keys a,b,c   # tie-break between chosen finalists (all clip orders)
//   node --env-file=narration/.env narration/cast.mjs --list male     # list library voices for the language
//   node --env-file=narration/.env narration/cast.mjs --design        # also create vo.json casting.designs (persistent!)
import fs from 'fs';
import path from 'path';
import { VO, LANG, PROVIDER, ALIASES, DIR, state, ttsArgs, fmt } from './common.mjs';
import { tts, hear, judge, pool, has, JUDGES, geminiVoices, sonioxVoices, designVoice } from './providers.mjs';
import { wer, norm } from './text.mjs';
import { analyse } from './wav.mjs';

const args = process.argv.slice(2);
const C = VO.casting || {};
if (args.includes('--list')) {
  const gender = args[args.indexOf('--list') + 1];
  const vs = PROVIDER === 'gemini' ? await geminiVoices({ language_code: LANG, ...(gender && !gender.startsWith('--') ? { gender } : {}) }) : await sonioxVoices(gender && !gender.startsWith('--') ? { gender } : {});
  vs.forEach(v => console.log(`${String(v.id).padEnd(26)} ${(v.gender || '').padEnd(7)} ${(v.pitch || v.age || '').padEnd(12)} ${(v.persona || v.accent || '').slice(0, 50).padEnd(50)} ${(v.description || '').slice(0, 110)}`));
} else {
const OUT = path.join(DIR, 'casting'); fs.mkdirSync(OUT, { recursive: true });
const { s: S, save } = state('casting/casting.json', { designed: {}, takes: {} });
const EARS = has('GEMINI_API_KEY') ? (VO.judges || JUDGES) : [];
const isPT = /^pt-PT$/i.test(LANG);

// 1) optional Voice Design voices (persistent in the user's project: reuse by key, never recreate)
if (args.includes('--design')) for (const d of C.designs || []) {
  if (S.designed[d.key]) continue;
  const v = await designVoice({ description: d.description, displayName: `${VO.brand || 'Promo'} VO ${d.key}`, languageCode: LANG, gender: d.gender || 'female' });
  S.designed[d.key] = { id: v.id, description: d.description, gender: d.gender };
  if (v.sample) fs.writeFileSync(path.join(OUT, `design_${d.key}_preview.wav`), v.sample);
  save(); console.log('designed', d.key, '->', v.id);
}
const voices = [...(C.candidates || []).map(c => (typeof c === 'string' ? { key: c, voice: c } : c)),
  ...Object.entries(S.designed).map(([k, v]) => ({ key: `design-${k}`, voice: v.id }))];
if (!voices.length) { console.error('no candidates: fill vo.json casting.candidates (see --list)'); process.exit(1); }

const RUBRIC = {
  type: 'OBJECT',
  properties: {
    transcript: { type: 'STRING' }, accent: { type: 'STRING' }, native_accent: { type: 'NUMBER' },
    energy: { type: 'NUMBER' }, warmth: { type: 'NUMBER' }, confidence: { type: 'NUMBER' }, clarity: { type: 'NUMBER' },
    naturalness: { type: 'NUMBER' }, commercial_polish: { type: 'NUMBER' }, brand_fit: { type: 'NUMBER' },
    brand_name_pronunciation: { type: 'STRING' }, artifacts: { type: 'STRING' }, overall: { type: 'NUMBER' }, notes: { type: 'STRING' },
  },
  required: ['transcript', 'accent', 'native_accent', 'energy', 'warmth', 'confidence', 'clarity', 'naturalness', 'commercial_polish', 'brand_fit', 'brand_name_pronunciation', 'artifacts', 'overall', 'notes'],
};
const PROMPT = `You are casting the voice-over for this commercial: ${VO.brief}
Language/accent required: ${LANG}${isPT ? ' — European Portuguese as spoken in PORTUGAL (Lisbon/Porto standard). Brazilian features (open unstressed vowels, "t/d" palatalised before i, gerund-heavy rhythm) must push native_accent below 5.' : ''}.
Listen critically and score 0-10 (10 = best, strict, use the full range): native_accent, energy, warmth, confidence, clarity (diction), naturalness (human prosody, no robotic artefacts), commercial_polish (studio-grade ad read), brand_fit (does this voice embody the brand described above?).
Describe how the brand name "${VO.brand}" was pronounced, list artifacts (glitches, wrong words) or "none", and give overall (would you cast this voice for this ad?).`;

// 2) takes + checks
const TAKES = C.takes || 2;
const jobs = voices.flatMap(v => Array.from({ length: TAKES }, (_, k) => ({ ...v, k })));
await pool(jobs, PROVIDER === 'soniox' ? 3 : 4, async j => {
  const id = `${j.key}_t${j.k}`, f = path.join(OUT, `${id}.wav`);
  if (!fs.existsSync(f)) fs.writeFileSync(f, await tts(ttsArgs(C.text, C.style || VO.style, j.voice)));
  const tk = (S.takes[id] ??= { key: j.key, voice: j.voice, file: path.basename(f) });
  const wav = fs.readFileSync(f);
  if (!tk.heard) { tk.heard = (await hear(wav, LANG)).text; save(); }
  const a = analyse(wav);
  Object.assign(tk, { wer: +wer(C.text, tk.heard, LANG, ALIASES).toFixed(3), dur: +a.duration.toFixed(2), wps: +(norm(C.text, LANG).split(' ').length / Math.max(0.1, a.speech)).toFixed(2), f0: a.f0 });
  tk.scores ??= {};
  for (const m of EARS) if (!tk.scores[m]) { tk.scores[m] = await judge({ model: m, clips: [{ label: 'A', wav }], prompt: PROMPT, schema: RUBRIC }); save(); }
  save();
});

// 3) ranking: accent gate, exact words, then weighted ad quality (or objective metrics without ears)
const W = { brand_fit: 0.22, energy: 0.14, confidence: 0.14, warmth: 0.12, naturalness: 0.14, commercial_polish: 0.14, clarity: 0.1 };
const agg = {};
for (const tk of Object.values(S.takes)) {
  if (!voices.find(v => v.key === tk.key) || !tk.f0) continue; // incomplete take (network error): rerun to fill it
  const a = (agg[tk.key] ??= { key: tk.key, voice: tk.voice, n: 0, nat: 0, q: 0, wer: 0, wps: 0, mv: 0, t: 0, accents: [], brand: [] });
  a.t++; a.wer += tk.wer; a.wps += tk.wps; a.mv += tk.f0.movement;
  for (const s of Object.values(tk.scores || {})) {
    if (!s || s.error) continue;
    a.n++; a.nat += s.native_accent; a.q += Object.entries(W).reduce((acc, [k, w]) => acc + w * s[k], 0); a.accents.push(s.accent); a.brand.push(s.brand_name_pronunciation);
  }
}
const ranked = Object.values(agg).map(a => {
  const r = { ...a, wer: a.wer / a.t, wps: a.wps / a.t, mv: a.mv / a.t, nat: a.n ? a.nat / a.n : null, q: a.n ? a.q / a.n : null };
  r.final = r.n ? r.q - (r.nat < 8 ? 5 : 0) - 10 * r.wer : -10 * r.wer + 2 * r.mv; // without ears: exact words + liveliness
  return r;
}).sort((x, y) => y.final - x.final);
S.ranked = ranked; save();
console.table(ranked.map(r => ({ voice: r.key, WER: fmt(r.wer, 3), 'words/s': fmt(r.wps), pitch_mv: fmt(r.mv, 3), native: fmt(r.nat, 1), quality: fmt(r.q), final: fmt(r.final), brand_heard_as: (r.brand[0] || '').slice(0, 40) })));

// 4) optional side-by-side final among the top N: several clip orders x each ear, Borda count
// --final N: top N of the ranking · --final-keys a,b,c: explicit finalists (tie-break); 3 or fewer finalists get every clip order
const FK = args.includes('--final-keys') ? args[args.indexOf('--final-keys') + 1].split(',') : null;
const NF = FK ? FK.length : args.includes('--final') ? Number(args[args.indexOf('--final') + 1] || 5) : 0;
if (NF && EARS.length) {
  const avg = tk => { const s = Object.values(tk.scores || {}).filter(x => x && !x.error); return s.reduce((a, b) => a + b.overall, 0) / (s.length || 1); };
  const cands = (FK ? FK.map(k => ranked.find(r => r.key === k)).filter(Boolean) : ranked.slice(0, NF)).map(r => { const best = Object.values(S.takes).filter(t => t.key === r.key).sort((a, b) => avg(b) - avg(a))[0]; return { key: r.key, wav: fs.readFileSync(path.join(OUT, best.file)) }; });
  const N = cands.length, PERMS = 4;
  const allOrders = a => (a.length <= 1 ? [a] : a.flatMap((x, i) => allOrders([...a.slice(0, i), ...a.slice(i + 1)]).map(r => [x, ...r])));
  const perms = N <= 3 ? allOrders(cands) : Array.from({ length: PERMS }, (_, p) => { const rot = cands.map((_, i) => cands[(i + p * Math.ceil(N / PERMS)) % N]); return p % 2 ? rot.reverse() : rot; });
  const SCH = { type: 'OBJECT', properties: { ranking: { type: 'ARRAY', items: { type: 'STRING' } }, reasons: { type: 'STRING' } }, required: ['ranking', 'reasons'] };
  const borda = Object.fromEntries(cands.map(c => [c.key, 0])), wins = Object.fromEntries(cands.map(c => [c.key, 0]));
  const runs = await pool(perms.flatMap(order => EARS.map(m => ({ order, m }))), 4, async ({ order, m }) => {
    const clips = order.map((c, i) => ({ label: String.fromCharCode(65 + i), wav: c.wav }));
    const r = await judge({ model: m, clips, schema: SCH, prompt: `These are ${N} candidate voice-overs (clips ${clips.map(c => c.label).join(', ')}) reading the same copy. The commercial: ${VO.brief} Required accent: ${LANG}. Rank ALL clips from best to worst for: native accent, brand fit, energy and confidence, warmth, studio-grade commercial polish, and making the viewer want to act. Return clip letters only in "ranking".` });
    const keys = r.ranking.map(l => order[String(l).trim().toUpperCase().charCodeAt(0) - 65]?.key).filter(Boolean);
    keys.forEach((k, i) => { borda[k] += N - 1 - i; }); if (keys[0]) wins[keys[0]]++;
    return { m, keys, reasons: r.reasons };
  });
  const table = Object.keys(borda).map(k => ({ voice: k, borda: borda[k], wins: wins[k] })).sort((a, b) => b.borda - a.borda);
  S.final = { table, runs }; save();
  console.table(table);
  runs.filter(r => r?.keys?.[0] === table[0].voice).slice(0, 2).forEach(r => console.log(`[${r.m}] ${String(r.reasons).slice(0, 320)}`));
}
const pick = S.final?.table?.[0]?.voice || ranked[0]?.key;
console.log(`\nrecommended: ${pick} -> ${voices.find(v => v.key === pick)?.voice}  (set "voice" in narration/vo.json)`);
}
