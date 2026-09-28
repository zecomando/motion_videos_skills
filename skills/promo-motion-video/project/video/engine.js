/* Deterministic motion engine. Every frame is a pure function of t (seconds): no CSS animations/transitions,
   no Date/performance/Math.random in rendering, no state carried between frames. window.seek(t) renders one frame
   and returns a promise while footage frames decode, so the renderer can screenshot any frame in any order.
   Preview in a browser: index.html?t=12.5 (one frame) · ?play · ?play&from=10 (real time, no audio). */
(function () {
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, p) => a + (b - a) * p;
  const E = {
    lin: x => x,
    inQuad: x => x * x,
    outQuad: x => 1 - (1 - x) * (1 - x),
    inCubic: x => x * x * x,
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outQuart: x => 1 - Math.pow(1 - x, 4),
    inOutQuart: x => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2),
    outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inExpo: x => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
    inOutExpo: x => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
    outBack: x => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  // progress of an animation that starts at a and lasts d, eased
  const P = (t, a, d, e = E.outExpo) => e(clamp((t - a) / d));
  // in-hold-out envelope: 0→1 over [a, a+din], 1 until b-dout, →0 at b
  const env = (t, a, b, din = 0.3, dout = 0.3, ei = E.outCubic, eo = E.inCubic) => (t < a || t > b ? 0 : Math.min(ei(clamp((t - a) / din)), 1 - eo(clamp((t - (b - dout)) / dout))));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  // set transform / opacity / blur only when given; numbers are rounded to keep the DOM cheap
  const st = (el, tr, op, blur) => {
    if (!el) return;
    if (tr != null) el.style.transform = tr;
    if (op != null) el.style.opacity = (+op).toFixed(3);
    if (blur != null) el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none';
  };
  const tr = (x = 0, y = 0, s = 1, r = 0) => `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)` + (s !== 1 ? ` scale(${s.toFixed(4)})` : '') + (r ? ` rotate(${r.toFixed(2)}deg)` : '');
  function rng(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* word masks: every word becomes <span class="wm"><span class="wi">word</span></span>; nested spans keep their
     class on the word (e.g. <span class="accent">), <br> and elements with [data-keep] are left as they are */
  function split(root) {
    const words = [];
    const walk = (node, cls) => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            const wm = document.createElement('span'); wm.className = 'wm';
            const wi = document.createElement('span'); wi.className = 'wi' + (cls ? ' ' + cls : ''); wi.textContent = p;
            wm.appendChild(wi); frag.appendChild(wm); words.push(wi);
          });
          n.replaceWith(frag);
        } else if (n.nodeName === 'BR' || (n.dataset && 'keep' in n.dataset)) { /* keep */ }
        else if (n.nodeName === 'SPAN' || n.nodeName === 'B' || n.nodeName === 'EM') { walk(n, n.className || n.nodeName.toLowerCase()); n.replaceWith(...n.childNodes); }
        else walk(n, cls);
      });
    };
    walk(root, ''); root._w = words; return words;
  }
  // reveal words from below their mask at their own times (VO_WORDS onsets) or with a stagger after `times`
  function rise(ws, t, times, d = 0.7, stagger = 0.06) {
    ws.forEach((w, i) => {
      const a = Array.isArray(times) ? times[Math.min(i, times.length - 1)] : times + i * stagger;
      const p = E.outExpo(clamp((t - a) / d));
      w.style.transform = `translate3d(0,${((1 - p) * 125).toFixed(2)}%,0)`; // 125%: accents of capitals stay hidden
    });
  }
  // hide words upward (exit), all together or staggered. Travels 140% and then hides the word: at -110% the
  // descenders (j, p, g) were still visible inside the mask's bottom padding. Opacity is set every frame.
  function sink(ws, t, a, d = 0.45, stagger = 0.02) {
    ws.forEach((w, i) => { const p = E.inCubic(clamp((t - a - i * stagger) / d)); if (p > 0) w.style.transform = `translate3d(0,${(-p * 140).toFixed(2)}%,0)`; w.style.opacity = p >= 1 ? '0' : '1'; });
  }
  // VO word onsets for a line (video/vo_words.js), slightly early so the word is readable as it is heard
  const vo = (id, lead = 0.05) => (window.VO_WORDS && window.VO_WORDS[id] ? window.VO_WORDS[id].map(x => x - lead) : null);

  /* footage: JPEG sequences made by frames.mjs (assets/footage/footage.js) shown in an <img>; seek() waits for decode */
  const pending = [];
  function footage(img, id, t0, t, { rate = 1, loop = false, offset = 0 } = {}) {
    const c = window.FOOTAGE && window.FOOTAGE[id];
    if (!c || !img) return;
    let f = Math.floor(((t - t0) * rate + offset) * c.fps + 1e-6);
    f = loop ? ((f % c.count) + c.count) % c.count : clamp(f, 0, c.count - 1);
    const src = `${c.dir}/${String(f + 1).padStart(4, '0')}.jpg`;
    if (img.dataset.src !== src) { img.dataset.src = src; img.src = src; pending.push(img.decode().catch(() => {})); }
  }
  const clipDur = id => (window.FOOTAGE && window.FOOTAGE[id] ? window.FOOTAGE[id].count / window.FOOTAGE[id].fps : 0);

  /* scenes: [{ id, a, b, fn(t, local) }] — shown with display toggling (visibility is inherited unreliably),
     overlapping ranges are allowed (transitions); `overlay(t, frame)` runs every frame after the scenes */
  function measureHidden(fn) {
    const all = $$('.scene'); all.forEach(s => { s.dataset.d = s.style.display; s.style.display = 'block'; });
    try { return fn(); } finally { all.forEach(s => { s.style.display = s.dataset.d || 'none'; }); }
  }
  function run({ scenes, init, overlay, fps = (window.CUES && window.CUES.fps) || 60 }) {
    const list = scenes.map(s => ({ ...s, el: document.getElementById(s.id) }));
    list.forEach(s => { if (!s.el) throw new Error('scene element #' + s.id + ' missing'); });
    window.seek = function (t) {
      for (const s of list) {
        const vis = t >= s.a && t < s.b;
        if (s.el.__vis !== vis) { s.el.style.display = vis ? 'block' : 'none'; s.el.__vis = vis; }
        if (vis) s.fn(t, t - s.a);
      }
      if (overlay) overlay(t, Math.round(t * fps));
      return pending.length ? Promise.all(pending.splice(0)) : undefined;
    };
    window.__ready = (async () => {
      await document.fonts.ready;
      if (init) await init();
      await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
      await window.seek(0);
      return true;
    })();
    const qs = new URLSearchParams(location.search);
    window.__ready.then(() => {
      if (qs.has('t')) window.seek(parseFloat(qs.get('t')));
      if (qs.has('play')) { const from = parseFloat(qs.get('from') || '0'), t0 = performance.now(), D = window.CUES.duration; const loop = now => { window.seek((from + (now - t0) / 1000) % D); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
    });
  }
  // film grain: one noise tile, moved by a seeded offset each frame (deterministic)
  function grain(el, opacity = 0.06) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), d = g.createImageData(256, 256), r = rng(7);
    for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    el.style.backgroundImage = `url(${c.toDataURL()})`; el.style.opacity = opacity;
    return frame => { const r2 = rng(frame * 9973 + 1); el.style.backgroundPosition = `${Math.floor(r2() * 256)}px ${Math.floor(r2() * 256)}px`; };
  }

  window.Engine = { clamp, lerp, E, P, env, $, $$, st, tr, rng, split, rise, sink, vo, footage, clipDur, measureHidden, run, grain };
})();
