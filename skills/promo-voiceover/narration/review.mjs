// Final QA with Gemini "eyes and ears" (needs GEMINI_API_KEY): uploads the finished video and asks two models to
// check every line (heard words, start time, intelligibility, sync with the picture), voice/music balance, native
// accent and persuasion. Treat the output as a second opinion: confirm any claimed defect with the numbers
// (verify-mix.mjs, loudness, frames) before changing the edit.
//   node --env-file=narration/.env narration/review.mjs out/<name>-web.mp4
import fs from 'fs';
import path from 'path';
import { VO, LANG, DIR, cues } from './common.mjs';
import { geminiUpload, askFile, JUDGES } from './providers.mjs';

const video = process.argv[2];
if (!video) { console.error('usage: review.mjs <video.mp4>'); process.exit(1); }
const C = cues(), P = JSON.parse(fs.readFileSync(path.join(DIR, 'phrases.json'), 'utf8')).phrases;
const expected = Object.entries(C.vo).map(([id, t]) => `[${t.toFixed(2)}s] ${P[id].text}`).join('\n');
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    lines: { type: 'ARRAY', items: { type: 'OBJECT', properties: { expected_start: { type: 'NUMBER' }, heard: { type: 'STRING' }, heard_start: { type: 'NUMBER' }, intelligible: { type: 'BOOLEAN' }, in_sync_with_visual: { type: 'BOOLEAN' }, issue: { type: 'STRING' } }, required: ['expected_start', 'heard', 'heard_start', 'intelligible', 'in_sync_with_visual', 'issue'] } },
    voice_vs_music_balance: { type: 'STRING' }, native_accent: { type: 'NUMBER' }, energy: { type: 'NUMBER' }, persuasion: { type: 'NUMBER' },
    production_quality: { type: 'NUMBER' }, visual_issues: { type: 'ARRAY', items: { type: 'STRING' } }, top_fixes: { type: 'ARRAY', items: { type: 'STRING' } }, summary: { type: 'STRING' },
  },
  required: ['lines', 'voice_vs_music_balance', 'native_accent', 'energy', 'persuasion', 'production_quality', 'visual_issues', 'top_fixes', 'summary'],
};
const PROMPT = `You are a demanding commercial post-production supervisor and a native ${LANG} creative director. Watch AND listen to this ${C.duration}-second commercial. Brief: ${VO.brief}\nScripted voice-over with intended start times:\n${expected}\n\nFor every scripted line: exactly what you hear, its actual start time, whether it is fully intelligible over the music, and whether it matches what is on screen at that moment. Then judge voice vs music balance (where too loud / too quiet), native ${LANG} accent, energy, persuasion and production quality (0-10, strict). List concrete visual issues (overlaps, unreadable text, glitches, awkward holds, with timestamps) and the top fixes (empty if none).`;

const f = await geminiUpload(video, 'video/mp4', fs, path);
const out = {};
for (const m of VO.judges || JUDGES) { try { out[m] = await askFile({ model: m, file: f, prompt: PROMPT, schema: SCHEMA }); } catch (e) { out[m] = { error: String(e.message).slice(0, 300) }; } }
fs.writeFileSync(path.join(DIR, 'review.json'), JSON.stringify(out, null, 1));
for (const [m, r] of Object.entries(out)) {
  if (r.error) { console.log(m, 'ERROR', r.error); continue; }
  console.log(`\n[${m}] accent=${r.native_accent} energy=${r.energy} persuasion=${r.persuasion} production=${r.production_quality}`);
  console.log('  balance:', r.voice_vs_music_balance);
  r.lines.forEach(l => console.log(`  ${(+l.expected_start).toFixed(2)}→${(+l.heard_start).toFixed(2)} ${l.intelligible ? 'ok ' : 'LOW'} ${l.in_sync_with_visual ? 'sync' : 'OFF '} ${l.heard}${l.issue && !/^(none|n\/a|)$/i.test(l.issue) ? '  !! ' + l.issue : ''}`));
  console.log('  visual:', r.visual_issues.join(' | ') || '—');
  console.log('  fixes:', r.top_fixes.join(' | ') || '—');
  console.log('  summary:', r.summary);
}
