// Intelligibility of the FINAL mix (voice + music + SFX): transcribe the delivered video's audio only (so
// on-screen text cannot help) and look every scripted line up near its cue time.
//   node --env-file=narration/.env narration/verify-mix.mjs out/<name>-web.mp4
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { VO, LANG, ALIASES, DIR, ROOT, cues } from './common.mjs';
import { hear } from './providers.mjs';
import { norm, applyAliases, timedWords } from './text.mjs';

const video = process.argv[2];
if (!video) { console.error('usage: verify-mix.mjs <video.mp4>'); process.exit(1); }
const C = cues(), P = JSON.parse(fs.readFileSync(path.join(DIR, 'phrases.json'), 'utf8')).phrases;
const wav = path.join(ROOT, 'out', 'verify_mix.wav');
spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
const r = await hear(fs.readFileSync(wav), LANG);
const tw = timedWords(r.tokens);
const N = s => applyAliases(norm(s, LANG), ALIASES).split(' ').filter(Boolean);
const heard = tw.flatMap(w => N(w.w).map(p => ({ w: p, s: w.s })));
let ok = 0;
const ids = Object.keys(C.vo);
for (const id of ids) {
  const want = N(P[id].text), t0 = C.vo[id];
  const near = tw.length ? heard.filter(w => w.s >= t0 - 0.6 && w.s <= t0 + P[id].dur + 0.8).map(w => w.w) : N(r.text);
  const miss = want.filter(w => !near.includes(w));
  ok += !miss.length;
  console.log(`${miss.length ? '!! ' : 'OK '} ${id} @${t0.toFixed(2)}  ${want.length - miss.length}/${want.length}  ${P[id].text}${miss.length ? '   missing: ' + miss.join(' ') : ''}`);
}
console.log(`\n${ok}/${ids.length} lines fully intelligible in the final mix${tw.length ? '' : ' (no word timings: whole-transcript check)'}`);
console.log('\ntranscript:', r.text);
