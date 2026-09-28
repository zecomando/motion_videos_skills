// Pronunciation A/B for risky terms (brand names, English words in a pt-PT read, URLs, acronyms, numbers).
// vo.json "pron": [{ id, canonical, variants: [...], line: "Sentence with {X}.", expect: "normalised words STT must hear" }]
// Each variant is rendered N times in its test sentence; a variant wins on STT hit-rate (the words a listener
// actually recovers) and, with GEMINI_API_KEY, on the AI ears' judgement of how natural it sounds.
//   node --env-file=narration/.env narration/pron.mjs      -> narration/pron.json (winners used by produce.mjs)
import fs from 'fs';
import path from 'path';
import { VO, LANG, PROVIDER, ALIASES, DIR, state, ttsArgs } from './common.mjs';
import { tts, hear, judge, pool, has, JUDGES } from './providers.mjs';
import { norm, applyAliases } from './text.mjs';

if (!VO.voice) { console.error('set "voice" in narration/vo.json first (cast.mjs)'); process.exit(1); }
const OUT = path.join(DIR, 'pron'); fs.mkdirSync(OUT, { recursive: true });
const { s: S, save } = state('pron.json');
const N = Number(process.argv[2] || 3);
const EARS = has('GEMINI_API_KEY') ? [JUDGES[0]] : [];

for (const t of VO.pron || []) {
  const expect = applyAliases(norm(t.expect || t.canonical, LANG), ALIASES);
  const runs = t.variants.flatMap((v, i) => Array.from({ length: N }, (_, k) => ({ v, i, k })));
  const res = await pool(runs, PROVIDER === 'soniox' ? 3 : 4, async ({ v, i, k }) => {
    const f = path.join(OUT, `${t.id}_${i}_${k}.wav`);
    const text = (t.line || '{X}').replace('{X}', v);
    if (!fs.existsSync(f)) fs.writeFileSync(f, await tts(ttsArgs(text, VO.style, VO.voice)));
    const heard = (await hear(fs.readFileSync(f), LANG)).text;
    return { i, k, f, heard, hit: applyAliases(norm(heard, LANG), ALIASES).includes(expect) };
  });
  const byVar = t.variants.map((v, i) => { const r = res.filter(x => x && x.i === i); return { v, i, hits: r.filter(x => x.hit).length, n: r.length, heard: r.map(x => x.heard) }; });
  if (EARS.length) {
    const clips = byVar.map(b => ({ label: String.fromCharCode(65 + b.i), wav: fs.readFileSync(path.join(OUT, `${t.id}_${b.i}_0.wav`)) }));
    const SCH = { type: 'OBJECT', properties: { per_clip: { type: 'ARRAY', items: { type: 'OBJECT', properties: { clip: { type: 'STRING' }, heard_as: { type: 'STRING' }, score: { type: 'NUMBER' } }, required: ['clip', 'heard_as', 'score'] } }, reasons: { type: 'STRING' } }, required: ['per_clip', 'reasons'] };
    const j = await judge({ model: EARS[0], clips, schema: SCH, prompt: `A/B variants of one line of a ${LANG} voice-over for this commercial: ${VO.brief}\nWhat is tested: ${t.label || t.canonical}. ${t.context || ''}\nFor each clip write phonetically how the tested words were heard and score 0-10 for how a native ${LANG} commercial announcer would naturally say them.` });
    j.per_clip.forEach(c => { const b = byVar[String(c.clip).trim().toUpperCase().slice(-1).charCodeAt(0) - 65]; if (b) { b.ear = c.score; b.earHeard = c.heard_as; } });
  }
  // STT hit-rate first (intelligibility), ears break ties
  byVar.sort((a, b) => b.hits / b.n - a.hits / a.n || (b.ear ?? 0) - (a.ear ?? 0));
  S[t.id] = { winner: byVar[0].v, table: byVar.map(({ v, hits, n, ear, earHeard, heard }) => ({ v, hits: `${hits}/${n}`, ear, earHeard, heard })) };
  save();
  console.log(`\n${t.id}: winner "${byVar[0].v}"`);
  console.table(byVar.map(b => ({ variant: b.v, stt_hits: `${b.hits}/${b.n}`, ear: b.ear ?? '—', ear_heard: (b.earHeard || '').slice(0, 40), sample: (b.heard[0] || '').slice(0, 60) })));
}
