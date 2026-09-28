// Create a promo project from this skill's template (and the promo-voiceover narration kit when present).
//   node <skills folder>/promo-motion-video/scripts/scaffold.mjs <projectDir> [--force]
//   (works from any skills folder: the voice kit is taken from the sibling promo-voiceover/ folder)
// Existing files are kept unless --force. Afterwards: cd <projectDir> && npm i (Playwright), unless a parent
// folder already provides node_modules/playwright.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SKILL = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dest = path.resolve(process.argv[2] || '.');
const force = process.argv.includes('--force');
const copy = (from, to) => {
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) { fs.mkdirSync(b, { recursive: true }); copy(a, b); }
    else if (force || !fs.existsSync(b)) { fs.copyFileSync(a, b); console.log('  +', path.relative(dest, b)); }
  }
};
fs.mkdirSync(dest, { recursive: true });
copy(path.join(SKILL, 'project'), dest);
const vo = path.join(path.dirname(SKILL), 'promo-voiceover', 'narration');
if (fs.existsSync(vo)) { fs.mkdirSync(path.join(dest, 'narration'), { recursive: true }); copy(vo, path.join(dest, 'narration')); }
for (const d of ['assets/brand', 'assets/fonts', 'assets/footage', 'out']) fs.mkdirSync(path.join(dest, d), { recursive: true });
// empty manifests so the page loads cleanly before any footage or voice exists (no 404 noise in the render log)
const empty = { 'assets/footage/footage.js': 'var FOOTAGE = {};\nif (typeof module !== \'undefined\') module.exports = FOOTAGE;\n', 'video/vo_words.js': 'var VO_WORDS = {};\nif (typeof module !== \'undefined\') module.exports = VO_WORDS;\n' };
for (const [f, body] of Object.entries(empty)) if (!fs.existsSync(path.join(dest, f))) fs.writeFileSync(path.join(dest, f), body);
let resolvable = false;
for (let d = dest; ; d = path.dirname(d)) { if (fs.existsSync(path.join(d, 'node_modules', 'playwright'))) { resolvable = true; break; } if (path.dirname(d) === d) break; }
console.log(`\nproject ready in ${dest}` + (resolvable ? '' : '\nnext: npm i   (installs Playwright; browsers: npx playwright install chromium)'));
