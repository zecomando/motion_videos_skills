// Brand research with Playwright: facts, design tokens and assets of a website.
//   node research.mjs https://brand.com [--pages 6] [--locale pt-PT] [--focus franchising,franquia]
//   --focus: internal pages whose URL or link text match these words are visited first (a topic-specific promo)
// Writes research/: info.json (fonts, colours, CSS variables, headings, CTAs, images, SVGs), text.txt,
// pages/*.txt (internal pages), hero.png, full.png, assets.json, sheet.png (contact sheet of the saved assets)
// and assets/raw/ (images, inline SVGs, web fonts captured from the page's own network responses).
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { launchOptions, argv } from './tools.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const URL0 = process.argv[2];
if (!URL0 || URL0.startsWith('--')) { console.error('usage: node research.mjs <url> [--pages N] [--locale xx-XX]'); process.exit(1); }
const OUT = path.join(ROOT, 'research'), RAW = path.join(ROOT, 'assets', 'raw');
for (const d of [OUT, path.join(OUT, 'pages'), path.join(RAW, 'img'), path.join(RAW, 'svg'), path.join(RAW, 'fonts')]) fs.mkdirSync(d, { recursive: true });
const PAGES = Number(argv('--pages', 6));

const browser = await chromium.launch(launchOptions());
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: argv('--locale', 'en-US'), deviceScaleFactor: 1 });
const page = await ctx.newPage();

// keep the bytes of every image and font the site loads, on every page visited (no second download)
const media = new Map();
ctx.on('response', async r => {
  try {
    const ct = (r.headers()['content-type'] || '').split(';')[0];
    const u = r.url();
    const kind = /^image\//.test(ct) ? 'img' : (/font|woff|opentype|truetype/.test(ct) || /\.(woff2?|ttf|otf)(\?|$)/i.test(u)) ? 'font' : null;
    if (!kind || media.has(u) || r.status() >= 300) return;
    if (/maps\.(googleapis|gstatic)\.com|\/maps\/vt|StaticMapService|\.cur(\?|$)|facebook\.com\/tr|google-analytics|doubleclick/i.test(u)) return; // map tiles, cursors, trackers
    const body = await r.body();
    if (body.length > 200) media.set(u, { kind, ct, body });
  } catch {}
});

// privacy-preserving consent: reject / necessary-only buttons first
async function dismissConsent(p) {
  const rx = /^(reject|reject all|decline|deny|refuse|only necessary|necessary only|essential only|use necessary cookies only|rejeitar|rejeitar tudo|recusar|recusar tudo|apenas (os )?necess[aá]rios|s[oó] necess[aá]rios|continuar sem aceitar|negar|negar tudo|não aceitar|nao aceitar|rechazar|ablehnen|refuser|weigeren|alleen noodzakelijk)/i;
  for (const fr of p.frames()) {
    const b = fr.getByRole('button', { name: rx }).first();
    if (await b.count().catch(() => 0)) { await b.click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(800); return true; }
  }
  // some consent tools render the choices as links/divs, not buttons (e.g. Complianz "Negar")
  for (const fr of p.frames()) {
    const el = fr.locator('a, span, div[role], div[class*="btn"], div[class*="button"]').filter({ hasText: rx }).filter({ visible: true }).last();
    if (await el.count().catch(() => 0)) { const txt = (await el.innerText().catch(() => '')).trim(); if (txt.length < 40) { await el.click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(800); return true; } }
  }
  return false;
}
async function load(p, url) {
  await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('  goto:', e.message.split('\n')[0]));
  await p.waitForTimeout(2000);
  await dismissConsent(p);
  // scroll to trigger lazy images and scroll-driven reveals, then back to the top
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 700) { await p.mouse.wheel(0, 700); await p.waitForTimeout(250); }
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1200);
}

await load(page, URL0);
const info = await page.evaluate(() => {
  const count = (m, k) => { if (k) m[k] = (m[k] || 0) + 1; };
  const fonts = {}, colors = {}, bgs = {};
  const els = [...document.querySelectorAll('body *')];
  for (const el of els) {
    const s = getComputedStyle(el);
    if (el.innerText && el.children.length === 0) { count(fonts, `${s.fontFamily.split(',')[0].replace(/["']/g, '').trim()} ${s.fontWeight}`); count(colors, s.color); }
    if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') count(bgs, s.backgroundColor);
    if (s.backgroundImage.includes('gradient')) count(bgs, 'GRADIENT ' + s.backgroundImage.slice(0, 200));
  }
  const vars = {};
  for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) if (r.selectorText && /^(:root|html|body)$/.test(r.selectorText.trim())) for (const p of r.style) if (p.startsWith('--')) vars[p] = r.style.getPropertyValue(p).trim(); } catch {} }
  const rect = el => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y + scrollY), w: Math.round(b.width), h: Math.round(b.height) }; };
  const where = el => (el.closest('header,nav') ? 'header' : el.closest('footer') ? 'footer' : 'body');
  const top = (m, n) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);
  return {
    url: location.href, lang: document.documentElement.lang, title: document.title,
    description: document.querySelector('meta[name=description]')?.content || null,
    ogImage: document.querySelector('meta[property="og:image"]')?.content || null,
    themeColor: document.querySelector('meta[name="theme-color"]')?.content || null,
    icons: [...document.querySelectorAll('link[rel*=icon]')].map(l => l.href),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    fonts: top(fonts, 12), colors: top(colors, 16), backgrounds: top(bgs, 20), cssVariables: vars,
    headings: [...document.querySelectorAll('h1,h2,h3,h4')].map(h => ({ tag: h.tagName, text: h.innerText.trim().replace(/\s+/g, ' '), size: getComputedStyle(h).fontSize, font: getComputedStyle(h).fontFamily.split(',')[0], weight: getComputedStyle(h).fontWeight, color: getComputedStyle(h).color, ...rect(h) })).filter(h => h.text).slice(0, 80),
    ctas: [...document.querySelectorAll('a,button')].filter(a => a.innerText.trim() && a.innerText.trim().length < 40).map(a => { const s = getComputedStyle(a); return { text: a.innerText.trim().replace(/\s+/g, ' '), href: a.getAttribute('href'), bg: s.backgroundColor, color: s.color, radius: s.borderRadius, border: s.border, font: `${s.fontSize} ${s.fontWeight}`, where: where(a) }; }).filter(a => a.bg !== 'rgba(0, 0, 0, 0)' || /btn|button/i.test(a.text)).slice(0, 30),
    links: [...document.querySelectorAll('a[href]')].map(a => ({ text: a.innerText.trim().replace(/\s+/g, ' ').slice(0, 60), href: a.href, where: where(a) })).slice(0, 150),
    images: [...document.images].map(i => ({ src: i.currentSrc || i.src, alt: i.alt, natural: [i.naturalWidth, i.naturalHeight], where: where(i), cls: String(i.className).slice(0, 80), ...rect(i) })).filter(i => i.src),
    svgs: [...document.querySelectorAll('svg')].filter(s => !s.parentElement.closest('svg')).map((s, i) => ({ i, where: where(s), cls: (s.getAttribute('class') || '') + ' | ' + (s.parentElement?.className?.baseVal ?? s.parentElement?.className ?? ''), label: s.getAttribute('aria-label') || s.closest('a')?.getAttribute('aria-label') || '', ...rect(s), html: s.outerHTML })).filter(s => s.w > 8),
    backgroundImages: [...new Set(els.map(el => getComputedStyle(el).backgroundImage).filter(b => b.includes('url(')))].slice(0, 30),
    masks: [...new Set(els.map(el => { const s = getComputedStyle(el); return s.clipPath !== 'none' ? 'clip ' + s.clipPath : s.maskImage && s.maskImage !== 'none' ? 'mask ' + s.maskImage : null; }).filter(Boolean))].slice(0, 12),
    videos: [...document.querySelectorAll('video')].map(v => ({ src: v.currentSrc || v.src || v.querySelector('source')?.src, poster: v.poster, ...rect(v) })),
    fontFaces: [...document.styleSheets].flatMap(s => { try { return [...s.cssRules].filter(r => r.constructor.name === 'CSSFontFaceRule').map(r => r.cssText.slice(0, 300)); } catch { return ['(cross-origin sheet) ' + s.href]; } }).slice(0, 30),
  };
});
fs.writeFileSync(path.join(OUT, 'text.txt'), await page.evaluate(() => document.body.innerText));
await page.screenshot({ path: path.join(OUT, 'hero.png') });
await page.screenshot({ path: path.join(OUT, 'full.png'), fullPage: true }).catch(e => console.log('  full.png:', e.message.split('\n')[0]));

// internal pages (about, services, cases, contact…) for facts
const host = new URL(info.url).host;
// same brand = same host or a subdomain of the same domain (landing pages often live on marketing.brand.pt)
const base = host.replace(/^www./, '').split('.').slice(-2).join('.');
const internal = [...new Set(info.links.map(l => l.href.split('#')[0]).filter(h => { try { const u = new URL(h); return (u.host === host || u.host === base || u.host.endsWith('.' + base)) && !/\.(pdf|jpg|png|zip)$/i.test(u.pathname) && u.pathname !== new URL(info.url).pathname; } catch { return false; } }))];
info.pages = [];
const FOCUS = (argv('--focus', '') || '').toLowerCase().split(',').filter(Boolean);
const linkText = u => info.links.filter(l => l.href.split('#')[0] === u).map(l => l.text).join(' ').toLowerCase();
if (FOCUS.length) internal.sort((a, b) => FOCUS.some(w => (b.toLowerCase() + linkText(b)).includes(w)) - FOCUS.some(w => (a.toLowerCase() + linkText(a)).includes(w)));
for (const u of internal.slice(0, PAGES)) {
  const p = await ctx.newPage();
  await load(p, u);
  const slug = (new URL(u).pathname.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-') || 'home').slice(0, 60);
  fs.writeFileSync(path.join(OUT, 'pages', slug + '.txt'), `${u}\n\n` + await p.evaluate(() => document.body.innerText));
  await p.screenshot({ path: path.join(OUT, 'pages', slug + '.png') });
  info.pages.push({ url: u, slug, title: await p.title() });
  await p.close();
}
await browser.close();

// save captured assets: images ≥ 200 px (or any SVG), fonts, inline SVGs
const ext = ct => ({ 'image/svg+xml': '.svg', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/avif': '.avif', 'image/gif': '.gif' })[ct] || '';
const saved = [];
const seenNames = new Set();
const nameFor = (u, e) => { let n = decodeURIComponent(path.basename(new URL(u).pathname)).replace(/[^\w.-]+/g, '_').slice(-70) || 'file'; if (e && !n.toLowerCase().endsWith(e)) n = n.replace(/\.[a-z0-9]+$/i, '') + e; while (seenNames.has(n)) n = '_' + n; seenNames.add(n); return n; };
for (const [u, m] of media) {
  const img = info.images.find(i => i.src === u);
  if (m.kind === 'img' && m.ct !== 'image/svg+xml' && img && Math.max(...img.natural) < 200) continue;
  const dir = m.kind === 'font' ? 'fonts' : 'img';
  const f = path.join(RAW, dir, nameFor(u, m.kind === 'img' ? ext(m.ct) : ''));
  fs.writeFileSync(f, m.body);
  saved.push({ file: path.relative(ROOT, f).replace(/\\/g, '/'), url: u, kind: m.kind, bytes: m.body.length, alt: img?.alt, natural: img?.natural, where: img?.where });
}
info.svgs.forEach(s => {
  const f = path.join(RAW, 'svg', `inline_${String(s.i).padStart(2, '0')}_${s.where}_${s.w}x${s.h}.svg`);
  fs.writeFileSync(f, s.html.includes('xmlns=') ? s.html : s.html.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));
  saved.push({ file: path.relative(ROOT, f).replace(/\\/g, '/'), kind: 'svg', where: s.where, size: [s.w, s.h], label: s.label });
  delete s.html;
});
fs.writeFileSync(path.join(OUT, 'info.json'), JSON.stringify(info, null, 1));
fs.writeFileSync(path.join(OUT, 'assets.json'), JSON.stringify(saved, null, 1));
// <video> sources are listed, not downloaded: fetch the ones worth using (node frames.mjs can cut them into frames)
if (info.videos.length) console.log('videos on the page:\n' + info.videos.map(v => `  ${v.w}x${v.h} ${v.src}`).join('\n'));

// contact sheet of everything saved (look at it before designing)
const visual = saved.filter(s => s.kind !== 'font');
const html = `<body style="margin:0;padding:16px;background:#e9e9e9;font:12px sans-serif;display:flex;flex-wrap:wrap;gap:12px;width:1560px">${visual.map((s, i) =>
  `<div style="width:240px;background:${i % 2 ? '#fff' : '#222'};padding:6px;color:${i % 2 ? '#000' : '#fff'}"><div style="height:150px;display:flex;align-items:center;justify-content:center"><img src="../${s.file}" style="max-width:228px;max-height:150px"></div><div style="word-break:break-all">${s.file.split('/').pop()}<br>${s.natural ? s.natural.join('x') : s.size ? s.size.join('x') : ''} ${s.where || ''}</div></div>`).join('')}</body>`;
fs.writeFileSync(path.join(OUT, 'sheet.html'), html);
const b2 = await chromium.launch(launchOptions());
const p2 = await b2.newPage({ viewport: { width: 1600, height: 900 } });
await p2.goto('file:///' + path.join(OUT, 'sheet.html').replace(/\\/g, '/'));
await p2.waitForTimeout(1500);
await p2.screenshot({ path: path.join(OUT, 'sheet.png'), fullPage: true });
await b2.close();

console.log(JSON.stringify({ title: info.title, lang: info.lang, description: info.description, fonts: info.fonts.slice(0, 5), colors: info.colors.slice(0, 6), cssVariables: Object.keys(info.cssVariables).length, headings: info.headings.length, images: info.images.length, svgs: info.svgs.length, saved: saved.length, pages: info.pages.map(p => p.slug) }, null, 1));
