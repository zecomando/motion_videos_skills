// Provider clients. Keys come from the environment (run scripts with `node --env-file=narration/.env ...`):
//   GEMINI_API_KEY  -> Gemini 3.8 Flash TTS (native pt-PT voices, Voice Design), audio "ears" (judge), transcribe, video review
//   SONIOX_API_KEY  -> Soniox TTS (tts-rt-v2, 60+ languages, no pt-PT/pt-BR split) and async STT with word timings
const GBASE = 'https://generativelanguage.googleapis.com';
const need = k => { const v = process.env[k]; if (!v) throw new Error(`${k} missing: put it in narration/.env and run node --env-file=narration/.env`); return v; };
export const has = k => !!process.env[k];
export const GEMINI_TTS = 'gemini-3.8-flash-tts';
export const SONIOX_TTS = 'tts-rt-v2';
export const JUDGES = ['gemini-3.8-flash', 'gemini-3.1-pro-preview'];

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function retry(fn, tries = 5) {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= tries - 1 || !/\b(429|5\d\d)\b|ECONN|fetch failed|timeout/i.test(String(e.message))) throw e;
      await sleep(1500 * 2 ** i);
    }
  }
}
async function gcall(url, body, method = 'POST') {
  return retry(async () => {
    const r = await fetch(url, { method, headers: { 'x-goog-api-key': need('GEMINI_API_KEY'), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const txt = await r.text();
    if (!r.ok) throw new Error(`${r.status} ${url.replace(GBASE, '')}: ${txt.slice(0, 400)}`);
    return txt ? JSON.parse(txt) : {};
  });
}

/* ---------------- TTS ---------------- */
// Gemini: `text` is read verbatim (inline tags like <breath>, <short pause>; CAPS for emphasis);
// `style` is a short delivery string (e.g. "warm, confident, energetic"). Returns 24 kHz mono WAV.
export async function geminiTTS({ text, style = '', voice, model = GEMINI_TTS }) {
  const item = { type: 'text', text };
  if (style) item.annotations = [{ type: 'speech_metadata', style }];
  const j = await gcall(`${GBASE}/v1beta/interactions`, {
    model, input: [{ type: 'user_input', content: [item] }],
    response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: 24000 },
    generation_config: { speech_config: [{ voice }] },
  });
  for (const step of j.steps || []) for (const c of step.content || []) if (c.type === 'audio' && c.data) return Buffer.from(c.data, 'base64');
  throw new Error('no audio in Gemini response: ' + JSON.stringify(j).slice(0, 300));
}
// Soniox: tags in English square brackets ([warm], [pause]), *word* for stress; speed 0.7–1.3. Returns WAV.
export async function sonioxTTS({ text, voice, language = 'en', speed, reduceSilence, sampleRate = 48000 }) {
  const body = { model: SONIOX_TTS, language: language.split('-')[0], voice, audio_format: 'wav', sample_rate: sampleRate, text };
  if (speed != null) body.speed = speed;
  if (reduceSilence != null) body.reduce_silence = reduceSilence;
  return retry(async () => {
    const r = await fetch('https://tts-rt.soniox.com/tts', { method: 'POST', headers: { Authorization: `Bearer ${need('SONIOX_API_KEY')}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`Soniox TTS ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return Buffer.from(await r.arrayBuffer());
  });
}
export const tts = ({ provider, ...o }) => (provider === 'soniox' ? sonioxTTS(o) : geminiTTS(o));

/* ---------------- voices ---------------- */
// Gemini voice library (prebuilt catalogue + your stored designed voices), e.g. {language_code:'pt-PT', gender:'male', type:'prebuilt'}
export async function geminiVoices(filter = {}) {
  const q = new URLSearchParams(); Object.entries({ page_size: 200, ...filter }).forEach(([k, v]) => [].concat(v).forEach(x => q.append(k, x)));
  const out = []; let token;
  do { if (token) q.set('page_token', token); const j = await gcall(`${GBASE}/v1beta/voices?${q}`, null, 'GET'); out.push(...(j.voices || [])); token = j.next_page_token; } while (token);
  return out;
}
// Voice Design creates a PERSISTENT voice in the user's Google project (1-year TTL, 200 per project):
// list existing ones first and only create when nothing suitable exists.
export async function designVoice({ description, displayName, languageCode = 'pt-PT', gender = 'female' }) {
  const j = await gcall(`${GBASE}/v1beta/voices`, { store: true, voice: { model: GEMINI_TTS, type: 'prompted', display_name: displayName, gender, language_code: languageCode, prompted: { input: description } } });
  return { id: j.id || j.voice?.id || j.name, sample: j.sample_audio?.data ? Buffer.from(j.sample_audio.data, 'base64') : null };
}
export async function sonioxVoices(filter = {}) {
  const q = new URLSearchParams({ model: SONIOX_TTS, ...filter });
  const r = await fetch(`https://api.soniox.com/v1/shared-voices?${q}`, { headers: { Authorization: `Bearer ${need('SONIOX_API_KEY')}` } });
  if (!r.ok) throw new Error(`Soniox voices ${r.status}`);
  const j = await r.json(); return j.voices || j.items || j;
}

/* ---------------- STT (verification + word timings) ---------------- */
// Soniox async STT: upload → transcribe → poll → tokens {text, start_ms, end_ms}; deletes file + transcription after.
// Token times are estimates that trail the real onsets by ~0–0.4 s: never cut audio on them directly.
export async function stt(wav, { language = 'pt', context } = {}) {
  const AUTH = { Authorization: `Bearer ${need('SONIOX_API_KEY')}` };
  const form = new FormData();
  form.append('file', new Blob([wav], { type: 'audio/wav' }), 'take.wav');
  const up = await retry(async () => { const r = await fetch('https://api.soniox.com/v1/files', { method: 'POST', headers: AUTH, body: form }); if (!r.ok) throw new Error(`upload ${r.status}: ${(await r.text()).slice(0, 200)}`); return r.json(); });
  const req = { model: 'stt-async-v5', file_id: up.id, language_hints: [language.split('-')[0]] };
  if (context) req.context = context;
  const tr = await retry(async () => { const r = await fetch('https://api.soniox.com/v1/transcriptions', { method: 'POST', headers: { ...AUTH, 'Content-Type': 'application/json' }, body: JSON.stringify(req) }); if (!r.ok) throw new Error(`create ${r.status}: ${(await r.text()).slice(0, 200)}`); return r.json(); });
  let st;
  try {
    for (let i = 0; i < 180; i++) {
      st = await (await fetch(`https://api.soniox.com/v1/transcriptions/${tr.id}`, { headers: AUTH })).json();
      if (st.status === 'completed' || st.status === 'error') break;
      await sleep(1000);
    }
    if (st.status !== 'completed') throw new Error('STT failed: ' + JSON.stringify(st).slice(0, 300));
    const tj = await (await fetch(`https://api.soniox.com/v1/transcriptions/${tr.id}/transcript`, { headers: AUTH })).json();
    return { text: tj.text, tokens: tj.tokens || [] };
  } finally {
    await fetch(`https://api.soniox.com/v1/transcriptions/${tr.id}`, { method: 'DELETE', headers: AUTH }).catch(() => {});
    await fetch(`https://api.soniox.com/v1/files/${up.id}`, { method: 'DELETE', headers: AUTH }).catch(() => {});
  }
}
// Gemini transcription (text only, no word timings). JSON mode is not supported by this model: read audioTranscription.text.
export async function geminiTranscribe(wav, hint = 'Transcribe all speech verbatim.') {
  const j = await gcall(`${GBASE}/v1beta/models/gemini-3.5-transcribe:generateContent`, { contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'audio/wav', data: wav.toString('base64') } }, { text: hint }] }] });
  return (j.candidates?.[0]?.content?.parts || []).map(p => p.audioTranscription?.text || p.text || '').join(' ').trim();
}
// transcript for checking a take: Soniox when available (timings), else Gemini (text only)
export async function hear(wav, language = 'pt') {
  if (has('SONIOX_API_KEY')) return stt(wav, { language });
  return { text: await geminiTranscribe(wav, `Transcribe all speech verbatim (${language}).`), tokens: [] };
}

/* ---------------- AI "ears" ---------------- */
// Ask an audio-understanding model about one or more clips; returns JSON matching `schema` (Gemini schema format).
export async function judge({ model = JUDGES[0], clips, prompt, schema, temperature = 0.2 }) {
  const parts = [];
  clips.forEach((c, i) => { parts.push({ text: `CLIP ${c.label ?? i + 1}:` }); parts.push({ inline_data: { mime_type: 'audio/wav', data: c.wav.toString('base64') } }); });
  parts.push({ text: prompt });
  const j = await gcall(`${GBASE}/v1beta/models/${model}:generateContent`, { contents: [{ role: 'user', parts }], generationConfig: { temperature, responseMimeType: 'application/json', responseSchema: schema } });
  return JSON.parse((j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join(''));
}
// Files API upload (large audio/video for review)
export async function geminiUpload(file, mime, fs, path) {
  const size = fs.statSync(file).size, KEY = need('GEMINI_API_KEY');
  const start = await fetch(`${GBASE}/upload/v1beta/files`, { method: 'POST', headers: { 'x-goog-api-key': KEY, 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': size, 'X-Goog-Upload-Header-Content-Type': mime, 'Content-Type': 'application/json' }, body: JSON.stringify({ file: { display_name: path.basename(file) } }) });
  const up = await fetch(start.headers.get('x-goog-upload-url'), { method: 'POST', headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize', 'Content-Length': size }, body: fs.readFileSync(file) });
  let f = (await up.json()).file;
  while (f.state === 'PROCESSING') { await sleep(3000); f = await (await fetch(`${GBASE}/v1beta/${f.name}`, { headers: { 'x-goog-api-key': KEY } })).json(); }
  if (f.state !== 'ACTIVE') throw new Error('upload failed: ' + JSON.stringify(f).slice(0, 300));
  return f;
}
export async function askFile({ model = JUDGES[0], file, prompt, schema }) {
  const j = await gcall(`${GBASE}/v1beta/models/${model}:generateContent`, { contents: [{ role: 'user', parts: [{ file_data: { mime_type: file.mimeType, file_uri: file.uri } }, { text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: schema } });
  return JSON.parse(j.candidates[0].content.parts.map(p => p.text || '').join(''));
}

// run fn over items with n in flight (Soniox allows 3 concurrent TTS requests)
export async function pool(items, n, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) { const i = next++; try { out[i] = await fn(items[i], i); } catch (e) { out[i] = { error: String(e.message || e) }; console.error('  !', String(e.message).slice(0, 220)); } } }));
  return out;
}
