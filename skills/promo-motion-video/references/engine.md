# Timeline engine (video/engine.js) and renderer

## Determinism rules

- **Every frame depends on `t` alone.**
  - No CSS `animation`/`transition`, and no `Date`, `performance.now()` or `Math.random()` in rendering: use `Engine.rng(seed)`.
  - No state carried from the previous frame: the renderer seeks frames out of order across parallel workers.
- **Scenes are toggled with `display`.** Children with `visibility: visible` escape a hidden parent. `run()` handles this.
- **Measure hidden layout inside `Engine.measureHidden(() => …)`.** It shows every scene, runs the function, then hides them again. Use it in `init` for positions such as the button centre for the cursor.
- **Serve the page over HTTP.** CSS masks, `fetch()` for inline SVGs and fonts are CORS-blocked on `file://`. `render.mjs` starts a static server at the project root, so pages use `../assets/...` paths.
- **Stacking.** Give `.scene` `z-index: 0` so z-indexes inside a scene (panels, chips) stay below the overlays: wipes 10, grain 11, fade 12. Without it, a scene's `z-index: 30` chip showed on top of the transition wipe.
- **SVG groups.** A CSS `transform` on an SVG `<g>` replaces its `transform` attribute. Position with the attribute on an outer `<g>` and animate an inner one (`transform-box: fill-box; transform-origin: center`).
- **Word masks.** `rise` enters from +125% and `sink` exits to −140% then hides the word. At ±110%, descenders (j, p) and capital accents stayed visible inside the mask padding. Call `sink` every frame (it also restores opacity when seeking backwards).
- **Readiness.** `__ready` waits for fonts, `init()` and image decode. Before the render, footage frames are decoded inside `seek()`, which returns a promise; Playwright awaits it.

## API (`window.Engine`)

| Helper | Use |
|---|---|
| `P(t, a, d, ease)` | eased progress 0→1 of an animation starting at `a` lasting `d` |
| `env(t, a, b, din, dout)` | in-hold-out envelope |
| `st(el, transform, opacity, blur)` | set only what is given |
| `tr(x, y, s, r)` | transform string (`translate3d` + `scale` + `rotate`) |
| `split(el)` → `el._w` | word masks (`.wm > .wi`); nested `<span class>` and `<b>` keep their class on the word, `<br>` and `[data-keep]` are left alone |
| `rise(words, t, times \| start, d, stagger)` | words rise from their masks at VO onsets or with a stagger |
| `sink(words, t, a)` | words leave upward |
| `vo('v05')` | display-word onsets of VO line v05 (from `vo_words.js`), 50 ms early |
| `footage(img, id, t0, t, {rate, loop, offset})` | show the frame of clip `id` for time t (clip starts at `t0`) |
| `clipDur(id)` | clip length in seconds |
| `grain(el, opacity)` → `tick(frame)` | deterministic film grain |
| `run({ scenes:[{id,a,b,fn}], init, overlay })` | defines `seek`/`__ready`; scene ranges may overlap for transitions |

Preview in a normal browser (through any static server at the project root): `video/index.html?t=12.4` shows one frame; `?play&from=10` plays in real time.

## Footage

1. Run `node frames.mjs src.mp4 --cuts [--crop w:h:x:y]` to find the shot changes inside a crop.
2. Run `node frames.mjs src.mp4 <id> --ss 3.2 --t 3 --crop 487:1080:0:0 --w 540 --fps 30` to write a JPEG sequence and register it in `assets/footage/footage.js`.
3. Show it in an `<img>` with `object-fit: cover`, driven by `footage(img, id, t0, t)`. 30 fps sources simply repeat each frame twice at 60 fps.
4. Keep the sequences small: crop to the part you show, scale to the size on screen, `-q:v 3`.

Split-screen website videos (several vertical clips side by side) can be separated column by column: find the column edges on one frame first.

## Render

| Command | Output |
|---|---|
| `node render.mjs --stills 0.8,3.1,…` | PNG stills plus a labelled contact sheet (`out/sheet.png`) |
| `node render.mjs --segment a,b` | `out/segment.mp4`, to judge motion |
| `node render.mjs [--workers 3]` | `out/video.mp4`: JPEG q100 frames → x264 CRF 14, keyframe every second, chunks concatenated. It prints the frame count and must say `(exact)`. |

- **Speed.** Expect about 3–8 frames/s in total with 3 workers. Heavy CSS `filter: blur()`, big `box-shadow`s on many nodes, and large SVG filters are the usual slow-downs: prefer transforms and opacity.
- **Timeouts.** A screenshot timeout is retried; after two failures the page is rebuilt and the same frame re-seeked.
- **Chromium.** `tools.mjs` uses Playwright's own browser if it is installed, else the newest `ms-playwright/chromium-*` found on disk (override with `CHROME_PATH`).
