# Music, sound design and mix

## Soundtrack (audio.mjs + synth.mjs)

The soundtrack is synthesised sample by sample in JS: no samples and no libraries, fully locked to `video/cues.js`.

- **Instruments** (`synth.mjs`):
  - tonal: `pluckString`/`strum` (Karplus-Strong), `epiano` (FM Rhodes), `glock`, `supersaw` (stabs/pads with a filter sweep), `bass`, `upright`, `whistle`;
  - drums: `kick`, `snare`, `clap`, `hat`, `shaker`, `brush`;
  - effects: `riser`, `impact`, `subDrop`, `whoosh`, `pop`, `click`, `shutter`, `squeak`, `freeverb`.
- **Arrangement:**
  1. Hook: tension (ticking pulse, muted plucks, riser) ending exactly on the brand reveal.
  2. Brand: a **drop** (impact + chord stab + sub + sparkle on the letters).
  3. Value beats: a groove that is **sparse under the voice** (half the arpeggio notes, lower chord level).
  4. CTA: fuller, then a final chord and a fade with the picture.
- **Tempo and key.** Choose them from the brand mood:
  - warm and optimistic: 110–120 BPM, major, e-piano and plucks;
  - energetic agency or events: 122–128 BPM, four-on-the-floor, supersaw stabs, claps and hats;
  - playful: ukulele, whistle, glock.

  Put the downbeats on scene cuts: at 120 BPM a bar is 2 s, and at 125 BPM it is 1.92 s.
- **Sound design mapped to the picture:**
  - whoosh on every transition;
  - pop or tick on each UI item;
  - glock sparkle on reveals;
  - click and ripple on the CTA press;
  - counter ticks on count-ups.
- **Balance.** The lows must not bury the voice band. `check.mjs` flags lows more than 6 dB above mids. In the Fincredible job, a heavy kick and bass were pulled down to kick 0.24/0.32, bass 0.3, e-piano 0.36/0.42.

## Mix and master (mux.mjs)

| Step | Setting |
|---|---|
| Level match | music bed −19.5 LUFS, voice −15.5 LUFS (voice about 4 LU on top); adjust per project in `CUES.mix` |
| Ducking | `sidechaincompress threshold=0.02 ratio=5 attack=20 release=380 knee=4`, keyed by the voice |
| Voice chain | done in `narration/assemble.mjs`: HPF 80 Hz, −2 dB at 250 Hz, +2.5 dB at 3.5 kHz, +1.5 dB shelf at 10 kHz, 3:1 compression, limiter |
| Master | two-pass `loudnorm` to −14 LUFS integrated, true peak −1.5 dBTP before AAC (the encoded file lands under −1 dBTP), LRA 11; AAC 256 kb/s 48 kHz |
| Outputs | `out/<name>.mp4` (video stream copied from the CRF 14 master) and `out/<name>-web.mp4` (CRF 21, faststart, for sharing) |

## After the mix

- `node check.mjs out/<name>-web.mp4` checks frames, resolution, duration, loudness, band balance, static stretches, and writes a contact sheet.
- `node --env-file=narration/.env narration/verify-mix.mjs out/<name>-web.mp4` confirms every VO line is intelligible over the music.
- If a line fails, raise the voice 1–2 LU, deepen the ducking, or thin the arrangement under that line; then re-mux (no re-render needed).
