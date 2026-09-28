// Frame-accurate renderer: Playwright seeks the page to each frame time (window.seek(t), may return a promise),
// screenshots it as JPEG q100 and pipes the frames into FFmpeg (x264 CRF 14). Parallel workers are pages of ONE
// browser (separate browsers fight over the GPU and stall); chunks start on whole seconds = keyframes.
//   node render.mjs                         -> out/video.mp4 (silent master)
//   node render.mjs --stills 1,5.2,12       -> out/stills/*.png + out/sheet.png (contact sheet)
//   node render.mjs --segment 10,16         -> out/segment.mp4 (look at one passage in motion)
//   options: --workers 3  --fps 60
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { launchOptions, serve, run, argv } from './tools.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CUES = createRequire(import.meta.url)('./video/cues.js');
const OUT = path.join(ROOT, 'out'); fs.mkdirSync(OUT, { recursive: true });
const W = CUES.width || 1920, H = CUES.height || 1080;
const server = await serve(ROOT);
const PAGE = server.url('video/index.html');

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[page error]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.evaluate(() => window.__ready);
  return page;
}

async function stills(times) {
  const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch(launchOptions());
  const page = await openPage(browser);
  const files = [];
  for (const t of times) {
    await page.evaluate(t => window.seek(t), t);
    const f = path.join(dir, `t_${t.toFixed(2).padStart(6, '0')}.png`);
    await page.screenshot({ path: f }); files.push(f);
  }
  // contact sheet: 4 columns of 640 px thumbnails labelled with their time
  const cols = Math.min(4, files.length), tw = 640, th = Math.round(640 * H / W);
  await page.setViewportSize({ width: cols * tw, height: th });
  await page.setContent(`<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(${cols},${tw}px)">${files.map((f, i) =>
    `<div style="position:relative;width:${tw}px;height:${th}px"><img src="${server.url('out/stills/' + path.basename(f))}" style="width:100%;height:100%;display:block"><b style="position:absolute;left:6px;top:6px;font:bold 20px sans-serif;color:#fff;background:#000a;padding:2px 6px">${times[i].toFixed(2)}s</b></div>`).join('')}</body>`);
  await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
  await page.screenshot({ path: path.join(OUT, 'sheet.png'), fullPage: true });
  await browser.close();
  console.log(`stills -> out/stills | sheet -> out/sheet.png`);
}

async function renderChunk(browser, name, f0, f1, fps) {
  let page = await openPage(browser);
  // a stalled compositor occasionally times out a screenshot when pages run in parallel:
  // retry, then rebuild the page and re-seek the same frame (the timeline is deterministic)
  const shoot = async t => {
    for (let attempt = 0; ; attempt++) {
      try {
        await page.evaluate(t => window.seek(t), t);
        return await page.screenshot({ type: 'jpeg', quality: 100, timeout: 45000 });
      } catch (e) {
        if (attempt >= 3) throw e;
        console.error(`\n  ${name}: frame ${t.toFixed(3)}s retry ${attempt + 1} (${String(e.message).split('\n')[0]})`);
        if (attempt >= 1) { await page.close().catch(() => {}); page = await openPage(browser); }
      }
    }
  };
  const file = path.join(OUT, `${name}.mp4`);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-x264-params', `keyint=${fps}:min-keyint=${fps}:scenecut=0`, file],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const buf = await shoot(f / fps);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (name.endsWith('_0') && (f - f0) % fps === 0 && f > f0) { const p = (f - f0) / (f1 - f0); process.stdout.write(`\r  ${(100 * p).toFixed(0)}%  eta ${((Date.now() - t0) / 1000 * (1 - p) / p).toFixed(0)}s   `); }
  }
  ff.stdin.end(); await done; await page.close();
  return file;
}

const frames = file => parseInt(spawnSync('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout, 10); // csv output can end with a comma

async function renderAll() {
  const fps = Number(argv('--fps', CUES.fps || 60)), total = Math.round(CUES.duration * fps), workers = Number(argv('--workers', 3));
  const per = Math.ceil(total / workers / fps) * fps;
  console.log(`rendering ${total} frames @${fps}fps, ${workers} workers`);
  const t0 = Date.now(), browser = await chromium.launch(launchOptions()), jobs = [];
  for (let i = 0, f = 0; f < total; i++, f += per) jobs.push(renderChunk(browser, `chunk_${i}`, f, Math.min(total, f + per), fps));
  const files = await Promise.all(jobs);
  await browser.close();
  const list = path.join(OUT, 'chunks.txt');
  fs.writeFileSync(list, files.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
  await run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(OUT, 'video.mp4')]);
  files.forEach(f => fs.unlinkSync(f)); fs.unlinkSync(list);
  const n = frames(path.join(OUT, 'video.mp4'));
  console.log(`\nvideo -> out/video.mp4 in ${((Date.now() - t0) / 1000).toFixed(0)}s, ${n} frames ${n === total ? '(exact)' : `!! expected ${total}`}`);
}

async function segment(a, b) {
  const fps = CUES.fps || 60, browser = await chromium.launch(launchOptions());
  await renderChunk(browser, 'segment_0', Math.round(a * fps), Math.round(b * fps), fps);
  await browser.close();
  fs.renameSync(path.join(OUT, 'segment_0.mp4'), path.join(OUT, 'segment.mp4'));
  console.log(`\nsegment ${a}–${b}s -> out/segment.mp4`);
}

const A = process.argv;
if (A.includes('--stills')) await stills(argv('--stills', '1').split(',').map(Number));
else if (A.includes('--segment')) { const [a, b] = argv('--segment').split(',').map(Number); await segment(a, b); }
else await renderAll();
server.close();
