// Delivery checks: frame count, resolution/fps, duration, loudness and true peak, music band balance,
// long frozen/black stretches, and a contact sheet of the final file (out/check_sheet.png).
//   node check.mjs out/<name>-web.mp4
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const C = createRequire(import.meta.url)('./video/cues.js');
const file = process.argv[2] || path.join(ROOT, 'out', `${C.name || 'promo'}-web.mp4`);
const sh = (bin, args) => spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
const probe = JSON.parse(sh('ffprobe', ['-v', 'error', '-count_packets', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_packets,sample_rate,channels:format=duration,size', '-of', 'json', file]).stdout);
const v = probe.streams.find(s => s.codec_type === 'video'), a = probe.streams.find(s => s.codec_type === 'audio');
const fps = eval(v.r_frame_rate), want = Math.round(C.duration * (C.fps || 60));
const res = [];
const ok = (cond, label) => { res.push(`${cond ? 'OK ' : '!! '} ${label}`); return cond; };
ok(+v.nb_read_packets === want, `frames ${v.nb_read_packets} (expected ${want})`);
ok(v.width === (C.width || 1920) && v.height === (C.height || 1080) && Math.abs(fps - (C.fps || 60)) < 0.01, `video ${v.codec_name} ${v.width}x${v.height} @${fps}`);
ok(Math.abs(+probe.format.duration - C.duration) < 0.1, `duration ${(+probe.format.duration).toFixed(3)} s`);
if (a) {
  const ln = JSON.parse(sh('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-']).stderr.match(/{[^{}]*"input_i"[^{}]*}/)[0]);
  ok(Math.abs(+ln.input_i + 14) <= 0.5 && +ln.input_tp <= -0.8, `audio ${a.codec_name} ${a.sample_rate} Hz ${a.channels}ch, ${ln.input_i} LUFS, ${ln.input_tp} dBTP`);
} else ok(false, 'no audio stream');
const music = path.join(ROOT, 'out', 'music.wav');
if (fs.existsSync(music)) {
  const band = f => +(/mean_volume: (-?[\d.]+) dB/.exec(sh('ffmpeg', ['-hide_banner', '-nostats', '-i', music, '-af', `${f},volumedetect`, '-f', 'null', '-']).stderr) || [])[1];
  const lo = band('lowpass=f=150'), mid = band('highpass=f=150,lowpass=f=4000'), hi = band('highpass=f=4000');
  ok(lo - mid < 6, `music bands: lows ${lo} dB · mids ${mid} dB · highs ${hi} dB (lows should not dominate mids by > 6 dB)`);
}
const frozen = [...sh('ffmpeg', ['-hide_banner', '-i', file, '-vf', 'freezedetect=n=0.001:d=1.5', '-map', '0:v', '-f', 'null', '-']).stderr.matchAll(/freeze_start: ([\d.]+)[\s\S]*?freeze_duration: ([\d.]+)/g)].map(m => `${(+m[1]).toFixed(1)}s+${(+m[2]).toFixed(1)}`);
ok(true, `static stretches ≥1.5 s: ${frozen.join(', ') || 'none'} (holds are fine if intended, e.g. end card)`);
const n = 16, step = C.duration / n;
// exact sampling (the fps filter picked frames about half a step early): first frame, then the first frame at
// least `step` after the previous pick -> 0, step, 2·step…
sh('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vf', `select='isnan(prev_selected_t)+gte(t-prev_selected_t\\,${(step - 0.001).toFixed(4)})',scale=480:-2,tile=4x4:padding=4:color=black`, '-fps_mode', 'passthrough', '-frames:v', '1', path.join(ROOT, 'out', 'check_sheet.png')]);
console.log(res.join('\n') + `\nsheet -> out/check_sheet.png (row by row at ${Array.from({ length: n }, (_, i) => (i * step).toFixed(1)).join(', ')} s)`);
