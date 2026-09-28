# Gemini 3.8 Flash TTS (pt-PT voices, Voice Design, audio ears)

All calls take the header `x-goog-api-key` and use the base URL `https://generativelanguage.googleapis.com`. `providers.mjs` implements them.

## Synthesis: `POST /v1beta/interactions`

```json
{ "model": "gemini-3.8-flash-tts",
  "input": [{ "type": "user_input", "content": [{ "type": "text", "text": "<verbatim transcript>",
      "annotations": [{ "type": "speech_metadata", "style": "confident, energetic, warm" }] }] }],
  "response_format": { "type": "audio", "mime_type": "audio/wav", "sample_rate": 24000 },
  "generation_config": { "speech_config": [{ "voice": "pt-pt-…" | "voice_…" }] } }
```

The audio comes back in `steps[].content[]` as `{type:"audio", data: base64 WAV}`.

- **Text is read literally.**
  - Put no stage directions in the text.
  - Pace comes from punctuation (commas, `--`, `...`) and from `<short pause>` / `<long pause>`.
  - Emphasis: one CAPITALISED key word per line, at most.
  - Tags stay in English even in a pt-PT read.
- **`style` carries sustained delivery** (emotion, energy, pace, prosody) in a few English words. Keep one string per scene and reuse it for consistency.
- **Voice identity (age, gender, timbre, accent) never goes in `style`.** It comes from the chosen voice.
- **Inline vocal tags:** `<breath>`, `<exhales>`, `<chuckle>`, `<sigh>`, `<short pause>`, `<long pause>`, and others. Use them sparingly in ads; never use sound-effect tags.
- **Model choice:** `gemini-3.8-flash-tts` gives the best fidelity for ads. Flash-Lite is cheaper but less nuanced.

## Voices: `GET /v1beta/voices`

Filters (lists allowed): `language_code`, `gender`, `pitch`, `type` (prebuilt / prompted / replicated), `search`, `page_size`. The list has your stored voices first, then the catalogue.

- **pt-PT library.** There are about 33 female voices and a male set with IDs like `pt-pt-advisor-2`, `pt-pt-storyteller-8`, `pt-pt-concierge-2`, `pt-pt-podcaster-1`, `pt-pt-training-1`, `pt-pt-techagent-6`. Each voice has a persona, pitch and description. Run `cast.mjs --list male` to see the current set.
- **Voice Design: `POST /v1beta/voices`.**
  - Body: `{ store: true, voice: { model, type: "prompted", display_name, gender, language_code: "pt-PT", prompted: { input: "<1–2 sentence description>" } } }`.
  - The response includes a `voice_…` id and `sample_audio`.
  - The voice is persistent (1-year TTL, 200 per project). Reuse it, and never delete one without the user's OK.
- **Description recipe:**
  - Put permanent traits only in the description: age, origin and accent, timbre, texture, persona.
  - Delivery goes in `style`.
  - Example: "A bright, polished female presenter from Lisbon in her late twenties, native European Portuguese with clear, crisp diction and a lively medium-pitched voice that sounds genuinely optimistic."
- **Past result.** In the AI Solutions casting (pt-PT, female, inspiring), a designed voice ("bright") won the side-by-side Borda final. Library voices `pt-pt-concierge-2`, `pt-pt-storyteller-8` and `pt-pt-podcaster-1` followed.

## Audio ears: `POST /v1beta/models/{model}:generateContent`

- **Request.** Send audio `inline_data` (base64 WAV) with `generationConfig.responseMimeType: application/json` and a `responseSchema`.
- **Two ears.** Use two different models (`gemini-3.8-flash`, `gemini-3.1-pro-preview`) and average them.
- **Side-by-side finals.** Rotate the clip order across runs to cancel position bias, and combine the rankings with a Borda count.
- **Accent rubric.** Ask for the accent explicitly: native European Portuguese vs Brazilian. Brazilian features must push the score below 5.

## Transcription: `models/gemini-3.5-transcribe:generateContent`

- It returns text only, in `parts[].audioTranscription.text`.
- JSON mode is **not** supported by this model.
- There are no word timings: use Soniox STT when timings matter.

## Video review: Files API

- **Upload.** Resumable upload to `/upload/v1beta/files`, then poll the file until its state is `ACTIVE`.
- **Ask.** Send `file_data {mime_type, file_uri}` plus a prompt and schema to `gemini-3.8-flash` / `gemini-3.1-pro-preview`.
- **Treat the answer as an opinion.** Its timestamps are approximate.
