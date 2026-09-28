# Creative direction for brand promos

## Start from the brand, not from a template

- **Research first.** Run `node research.mjs <url> --pages 8` and read the outputs:
  - `research/text.txt` and `research/pages/*.txt`: facts, slogan, CTA wording, form of address;
  - `research/info.json`: fonts, colours, CSS variables, headings with sizes, CTA button styles;
  - `research/hero.png` and `research/full.png`: the look;
  - `research/sheet.png`: every captured asset.
- **Design tokens.**
  - **Colours:** the most-used colours in `info.colors`/`backgrounds`, plus the CTA button colour.
  - **Fonts:** the site's own woff2 files, from `assets/raw/fonts/`. Identify them by rendering a test line, then copy them to `assets/fonts/`.
  - **Logo:** prefer SVG (inline SVG in the header or footer). Use a raster logo only at or below its native size, because upscaling blurs. Never redraw or retype a logo.
- **Brand motif.** Derive ONE graphic device from the identity and reuse it everywhere: transitions, masks, frames, bullets. Examples:
  - Fincredible: the double arch of the logo's "B" became the wipe and the photo mask;
  - The Wild Theory: the site's four-column hero video became four footage columns = "four capabilities" that merge on "Zero silos", and four flame columns for every wipe;
  - an agency with a slab-serif monogram could use bold slab type cuts and its accent-colour bar.
- **Real media beats stock.** Use the brand's own photos and footage first (`frames.mjs` for video), and stock images from the site only as a last resort. Keep people's faces uncropped and never stretched.

## Story and pacing (voice-led)

- **Voice first.** Record the voice first (`promo-voiceover`), then place scenes around the phrase times (`CUES.vo`).
- **Beat structure.** hook → brand + slogan → value beats → proof → CTA. See `promo-voiceover/references/script-writing.md` for durations.
- **Voice and text.**
  - One idea per shot.
  - The on-screen headline echoes the voice; reveal its words at the voice's word onsets: `rise(words, t, vo('v05'))`.
  - Hold a fully revealed headline for at least 1.2 s.
- **Room to breathe.** Keep the voice off the brand reveal and music drops.
- **Scene length.** Change the image every 2–4 s. Something must always move: a slow push-in (3–6 % over the shot), drifting parallax, or a live counter.

## Typography (1920×1080)

| Role | Size | Notes |
|---|---|---|
| Headline | 104–160 px | display font 700–800, tracking −0.03 to −0.045 em, line-height 0.95–1.0, max ~7 words |
| Sub-copy | 36–52 px | body font 400–500, max 2 lines |
| Labels / eyebrows | 20–28 px | uppercase, tracking +0.12 em, accent or muted colour |
| Numbers | 180–320 px | count up with `E.outCubic`, tabular figures |

- **Margins and safe area.** Side margins of 140–180 px. Keep text inside the 90 % title-safe area.
- **Legibility over photos and video.** Use a gradient scrim (ink at 70–85 % towards the text side), or a solid panel in a brand colour.

## Motion language

- **Entrances.** `E.outExpo` or `E.outCubic` over 0.5–0.9 s. Words rise from masks with a 40–80 ms stagger. Cards rise 30–60 px and fade in over 0.15 s.
- **Exits.** `E.inCubic` over 0.3–0.45 s. Always clear a scene before the next one lands (no overlapping text).
- **Overshoot.** `E.outBack` only on small UI pieces (chips, buttons, badges), never on headlines or photos.
- **Transitions.** Use the brand motif as a 0.35–0.6 s wipe, with a whoosh in the music. Keep the flat-colour moment under 0.15 s: a long full-screen hold of one colour reads as a glitch.
- **Emphasis.** Use a colour switch on one keyword, an underline drawn under a word, a strike-through on the "problem" word, or a counter.
- **UI mock-ups.**
  - Build the product's world in HTML with the brand tokens: cards, lists, maps and routes, dashboards, phones, NFC taps.
  - Animate the data: count-ups, bars and check marks.
  - Numbers not taken from the site are illustrative: keep them plausible and say so in the report.
- **CTA.**
  - Button styled like the site's primary CTA (from `info.ctas`): cursor glides in, press, ripple.
  - Then the URL, with an underline drawn under it, and one line of reassurance.
  - End card holds at least 2.5 s, then the picture and music fade out together.

## Proof

- **Clients.** Use real client names from the site. If there are no logo files, set the names in the display font as a marquee or a grid. Never fake a logo.
- **Numbers.** Use real numbers with their meaning spelled out ("+290 lojas em routing coordenado").
- **Reviews.** Use one short, verbatim, attributed review with its star rating and review count.

## QA loop before the full render

1. **Stills.** Run `node render.mjs --stills <times>` at each scene's key moments (after every reveal and mid-transition), then read `out/sheet.png`. Check for:
   - overlapping or cut text;
   - blurred logos;
   - faces cropped by masks;
   - empty frames;
   - contrast.
2. **Motion.** For fast passages, render `node render.mjs --segment a,b` and look at frames extracted with FFmpeg.
3. **Final render.** Always a full clean render. Never splice re-rendered pieces with stream copy: that drifted the frame count (2702 instead of 2700).
