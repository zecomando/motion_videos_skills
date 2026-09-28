// Project config (narration/vo.json), state files and small shared helpers.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

export const DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.dirname(DIR);
export const VO = JSON.parse(fs.readFileSync(path.join(DIR, 'vo.json'), 'utf8'));
export const LANG = VO.language || 'pt-PT';
export const PROVIDER = VO.provider || (/^pt-PT$/i.test(LANG) ? 'gemini' : 'soniox');
export const ALIASES = VO.aliases || [];
export const lines = () => VO.groups.flatMap(g => g.lines.map(l => ({ ...l, group: g.id, style: l.style || g.style || VO.style })));

export function state(name, init = {}) {
  const f = path.join(DIR, name);
  const s = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : init;
  return { s, save: () => fs.writeFileSync(f, JSON.stringify(s, null, 1)) };
}
export function cues() {
  const f = path.join(ROOT, 'video', 'cues.js');
  return fs.existsSync(f) ? createRequire(import.meta.url)(f) : null;
}
// pause tag between lines read in one take (gives a clean silence to cut at)
export const PAUSE = PROVIDER === 'soniox' ? ' [pause] ' : ' <short pause> ';
// per-provider TTS options for a text + style
export function ttsArgs(text, style, voice) {
  return PROVIDER === 'soniox' ? { provider: 'soniox', text: style && !/^\[/.test(text) && VO.sonioxTag ? `[${VO.sonioxTag}] ${text}` : text, voice, language: LANG, speed: VO.speed }
    : { provider: 'gemini', text, style, voice };
}
// winning pronunciation spellings (pron.mjs) applied to the TTS text
export function applyPron(text) {
  const f = path.join(DIR, 'pron.json');
  if (!fs.existsSync(f)) return text;
  const P = JSON.parse(fs.readFileSync(f, 'utf8'));
  let out = text;
  for (const t of VO.pron || []) { const w = P[t.id]?.winner; if (w && t.canonical && w !== t.canonical) out = out.split(t.canonical).join(w); }
  return out;
}
export const fmt = (x, d = 2) => (x == null || Number.isNaN(x) ? '—' : (+x).toFixed(d));
