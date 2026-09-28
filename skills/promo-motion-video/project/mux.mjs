// Final mix, master and mux. With out/vo.wav: level-match voice and music (voice ~4 LU over the bed), duck the
// music under the voice (sidechain), then two-pass EBU R128 loudness normalisation (-14 LUFS, -1 dBTP).
//   node mux.mjs [--web]  -> out/<name>.mp4 (master, video stream copied) [+ out/<name>-web.mp4, CRF 21 for sharing]
//   name = CUES.name (video/cues.js) or --name x
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { argv } from './tools.mjs';

const CUES = createRequire(import.meta.url)('./video/cues.js');
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
const NAME = argv('--name', CUES.name || 'promo');
const video = path.join(OUT, 'video.mp4'), music = path.join(OUT, 'music.wav'), vo = path.join(OUT, 'vo.wav'), mix = path.join(OUT, 'mix.wav');
const final = path.join(OUT, `${NAME}.mp4`), web = path.join(OUT, `${NAME}-web.mp4`);
const target = 'I=-14:TP=-1.5:LRA=11'; // -1.5 dBTP before AAC so the encoded file stays under -1 dBTP
const MUSIC_LUFS = Number(argv('--music', CUES.mix?.music ?? -19.5)), VO_LUFS = Number(argv('--voice', CUES.mix?.voice ?? -15.5));

const ff = args => { const r = spawnSync('ffmpeg', args, { encoding: 'utf8', maxBuffer: 1 << 26 }); if (r.status) { console.error(r.stderr.slice(-2000)); process.exit(r.status); } return r; };
const measure = file => JSON.parse(ff(['-hide_banner', '-nostats', '-i', file, '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-']).stderr.match(/{[^{}]*"input_i"[^{}]*}/)[0]);

let src = music;
if (fs.existsSync(vo)) {
  const gm = MUSIC_LUFS - measure(music).input_i, gv = VO_LUFS - measure(vo).input_i;
  ff(['-v', 'error', '-y', '-i', music, '-i', vo, '-filter_complex',
    `[0:a]volume=${gm.toFixed(2)}dB[m];[1:a]volume=${gv.toFixed(2)}dB,asplit=2[v][sc];` +
    `[m][sc]sidechaincompress=threshold=${CUES.mix?.duckThreshold ?? 0.02}:ratio=${CUES.mix?.duckRatio ?? 5}:attack=20:release=380:knee=4[duck];` +
    `[duck][v]amix=inputs=2:normalize=0,atrim=0:${CUES.duration}[out]`, '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s24le', mix]);
  console.log(`music ${gm >= 0 ? '+' : ''}${gm.toFixed(1)} dB, voice ${gv >= 0 ? '+' : ''}${gv.toFixed(1)} dB -> out/mix.wav`);
  src = mix;
}
const m = measure(src);
const af = `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`;
ff(['-v', 'error', '-y', '-i', video, '-i', src, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', af, '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-t', String(CUES.duration), '-movflags', '+faststart', final]);
const after = measure(final);
console.log(`loudness ${m.input_i} -> ${after.input_i} LUFS, true peak ${after.input_tp} dBTP | master -> out/${NAME}.mp4`);
if (process.argv.includes('--web')) {
  ff(['-v', 'error', '-y', '-i', final, '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-maxrate', '14M', '-bufsize', '28M', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:a', 'copy', '-movflags', '+faststart', web]);
  console.log(`web -> out/${NAME}-web.mp4 (${(fs.statSync(web).size / 1e6).toFixed(1)} MB)`);
}
