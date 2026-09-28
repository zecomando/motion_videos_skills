// Shared helpers for the promo pipeline: Chromium discovery, a static file server, child processes.
import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn, spawnSync } from 'child_process';
import { chromium } from 'playwright';

// Playwright's own build if it is installed, else the newest ms-playwright chromium on disk.
export function launchOptions(extraArgs = []) {
  const args = ['--force-color-profile=srgb', '--hide-scrollbars', '--disable-lcd-text', '--font-render-hinting=none', ...extraArgs];
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args };
  try { if (fs.existsSync(chromium.executablePath())) return { args }; } catch {}
  const base = path.join(process.env.LOCALAPPDATA || path.join(process.env.HOME || '', '.cache'), 'ms-playwright');
  const dirs = fs.existsSync(base) ? fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1]) : [];
  for (const d of dirs) for (const exe of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
    const p = path.join(base, d, exe); if (fs.existsSync(p)) return { executablePath: p, args };
  }
  return { args };
}

// Static server rooted at `root` (CSS masks, fetch() and fonts are CORS-blocked on file://).
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm' };
export async function serve(root) {
  const server = http.createServer((req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204); return res.end(); }
    const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { url: p => `http://127.0.0.1:${server.address().port}/${p.replace(/^\//, '')}`, close: () => server.close() };
}

export function run(cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], ...opts });
    p.on('close', c => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}`))));
  });
}
// ffmpeg/ffprobe synchronously; throws with stderr on failure
export function ff(args, bin = 'ffmpeg') {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status) throw new Error(`${bin} failed: ${(r.stderr || '').slice(-1500)}`);
  return r;
}
export const argv = (k, d) => { const a = process.argv, i = a.indexOf(k); return i >= 0 && a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : d; };
