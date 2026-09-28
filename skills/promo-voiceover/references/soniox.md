# Soniox (TTS tts-rt-v2 · async STT stt-async-v5)

Auth: `Authorization: Bearer $SONIOX_API_KEY`. Implemented in `providers.mjs`.

## TTS — `POST https://tts-rt.soniox.com/tts`

```json
{ "model": "tts-rt-v2", "language": "en", "voice": "Nigel", "audio_format": "wav", "sample_rate": 48000,
  "text": "[warm] Let's make your numbers *unbelievably* clear.", "speed": 1.0 }
```

The response body is the audio.

- **Languages.** 60+ languages with the ISO code only (`pt`, `en`, `es` …). Any voice can speak any language. Portuguese is generic `pt`, with no pt-PT/pt-BR choice, so prefer Gemini for pt-PT.
- **Tags.** Audio tags are written in English in square brackets before the words they affect. Localised tags are not supported.
  - Emotion: `[warm] [excited] [calm] [happy] [curious] [delighted]`
  - Manner: `[sincerely] [reassuringly] [dramatically]`
  - Volume and pace: `[softly] [loudly] [slowly] [quickly]`
  - Human sounds: `[laughs] [chuckles] [sighs] [exhales]`
  - Pauses: `[pause] [long pause]`
- **Formatting.** UPPERCASE and `*stress*` for emphasis. Punctuation shapes the pace: `...`, `—`, `?!`.
- **`speed`.** Range 0.7–1.3. It rescales the whole take and can flatten rhythm, so pick a voice whose natural pace fits and keep changes small.
- **`reduce_silence`.** Optional; trims long pauses.
- **Limits.** 100 requests/min, **3 concurrent**, **2 minutes of audio per request** (longer audio is silently truncated: split the text).
- **Voices.** `GET https://api.soniox.com/v1/shared-voices?model=tts-rt-v2&gender=male` returns 119 male voices, each with a description, age, accent, use_case and style.
  - The Fincredible casting (English, commercial and collaborative) picked **Nigel**: British, broadcast, ads and explainers, about 2.9 words/s.
  - **Preston** (American, commercial, 3.25 words/s) was the alternate.
  - **Adrian** mangled the URL.

## STT (verification and word timings)

1. `POST /v1/files` (multipart `file`) → `{id}`.
2. `POST /v1/transcriptions {model:"stt-async-v5", file_id, language_hints:["pt"], context?}`.
3. Poll `GET /v1/transcriptions/{id}` until `completed`.
4. `GET /v1/transcriptions/{id}/transcript` → `{text, tokens:[{text,start_ms,end_ms,confidence}]}`.
5. DELETE the transcription and the file afterwards; `stt()` always does.

Behaviour to account for:
- **Tokens are sub-word pieces.** A piece that starts with a space starts a new word; `timedWords()` merges them.
- **Token times trail the real speech onsets by about 0–0.4 s.** Use them to decide *which* silence to cut at, never as cut points.
- **Brand checks must run without context.** `context` biases recognition towards given terms, so never use it for brand checks: a brand that only passes with context is not intelligible.
- **Numbers.** STT writes numbers as digits. `text.mjs` spells digits out (pt/en) before comparing.
