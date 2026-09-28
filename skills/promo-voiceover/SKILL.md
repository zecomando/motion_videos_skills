---
name: promo-voiceover
description: Criar narração com voz de IA para acompanhar um vídeo, a partir de um texto fornecido ou de um guião criado para uma marca. Orienta texto, língua, sotaque e estilo da voz com uma pergunta de cada vez; gera e verifica o áudio com Gemini ou Soniox. Pode ser usada sozinha ou com promo-motion-video.
---

# Criar narração com voz de IA

Transforma um guião em áudio falado para acompanhar um anúncio ou vídeo. Pode ajudar a escrever o texto, escolher a voz, acertar a pronúncia da marca e ajustar o ritmo à duração disponível.

**Exemplo:** uma voz feminina em português de Portugal a explicar um serviço durante 30 segundos, pronta a juntar às imagens.

**Entrega:** ficheiro de voz WAV, texto narrado e tempos das frases para montar o vídeo. O resultado desta skill é o áudio; para produzir também as imagens, usar `promo-motion-video`.

## Começar com uma pergunta de cada vez

Para uma nova narração, ler [as perguntas de definição](references/briefing.md).

- Aproveitar o texto, a duração e as preferências já fornecidos. Se vier de `promo-motion-video`, herdar o seu plano e perguntar apenas o que faltar para a voz.
- Fazer **uma única pergunta por interação** e esperar pela resposta. Não apresentar um formulário inteiro, juntar várias decisões numa pergunta ou tratar silêncio como resposta.
- Sugerir duas ou três opções claras quando útil e aceitar resposta livre ou «escolhe por mim». Perguntar sobre o resultado desejado; escolher internamente o serviço compatível, salvo preferência explícita do utilizador.
- Recolher as escolhas essenciais antes de gerar amostras ou takes. Depois, resumir o plano e executar; uma revisão de uma voz existente ou um pedido já completo não reinicia a definição.
- Para receber texto ou escolhas, pode usar uma ferramenta de perguntas. Para ficheiros, pedir anexo ou caminho numa mensagem normal. Credenciais em falta são configuradas localmente; não pedir chaves em texto no chat.

## Execução técnica

Report whether the review used audio playback, transcripts, measurements or AI "ears". When direct listening is unavailable, state that limitation and ask the user to listen before publishing.

## Setup

1. Copy this skill's `narration/` folder into the project root (`<project>/narration/`); project copies may be edited.
2. Copy `narration/.env.example` to `narration/.env` only when `.env` does not already exist. This file holds only keys the user supplied for this work: `GEMINI_API_KEY=` and/or `SONIOX_API_KEY=`. Never write keys into skill files or reports; recommend rotating keys pasted in chat.
3. Write `narration/vo.json` from `narration/vo.example.json` (brief, language, groups of lines, casting, pron tests).
4. Run everything from the project root: `node --env-file=narration/.env narration/<script>.mjs`. Needs Node 20.6+ (use a supported LTS release) and FFmpeg/ffprobe.

## Provider

| Need | Use |
|---|---|
| European Portuguese (pt-PT) | Gemini 3.8 Flash TTS: `pt-pt-*` library voices or Voice Design. Soniox has only generic `pt` (no pt-PT guarantee). |
| English and other languages | Soniox `tts-rt-v2` or Gemini; follow the user's choice when given |
| Word timings, take verification | Soniox STT (any language). Without a Soniox key: Gemini transcribe (text only; phrases are cut at the longest silences) |
| Accent / delivery judgement | Gemini audio models as two independent "ears" |

Provider details: `references/gemini.md`, `references/soniox.md`.

## Workflow (voice first, picture cut to the voice)

1. **Script** — follow `references/script-writing.md` when writing a new script; source brand claims from the brand's own site. If the user supplies text for a faithful reading, preserve its wording and keep pronunciation spellings in `tts`; ask before editorial changes unless already authorized. One `group` per scene; a group is read in one take.
2. **Cast** — reuse a voice already selected by the user for this work. Otherwise, `cast.mjs --list male|female` → put 6–14 candidates in `casting.candidates` → `cast.mjs --final 5`. The native-accent gate comes first. If the Borda final is close (wins spread evenly), break the tie with `cast.mjs --final-keys a,b,c`: three finalists heard in all six orders by both ears. Set `voice` in `vo.json`.
3. **Pronunciation** — brand names, English words inside a pt-PT read, URLs, acronyms → `pron` tests → `pron.mjs`. Winners are applied to the TTS text automatically; the screen keeps the real spelling.
4. **Produce** — `produce.mjs` → `narration/phrases.json`. Gate: every phrase `OK` (all words heard). Fix a failure with a pron variant or `--regroup gX` for fresh takes; reword only within the script-editing scope agreed above.
5. **Lay out** — for a new video, `assemble.mjs --suggest` prints a `vo:` block; paste it into `video/cues.js` and build the scenes around those times. For an existing locked edit, respect its available intervals and fit the narration within them; do not replace the agreed timings with the suggested layout.
6. **Assemble** — `assemble.mjs` → `out/vo.wav` + `video/vo_words.js` (onset of every displayed word, for text reveals).
7. **After the mix, when a mixed video is available** — `verify-mix.mjs out/<name>-web.mp4` must report every line intelligible. `review.mjs` (Gemini watches the video) is an optional second opinion; confirm its claims with measurements before re-editing. For audio-only delivery, report phrase checks and state that intelligibility against a future music bed has not yet been checked.

For audio-only work, `assemble.mjs` still reads `video/cues.js`: create that folder and a minimal CommonJS file exporting `CUES.vo` (the times from `--suggest`) and `CUES.duration` (enough for the final phrase and its tail). Export the object with `module.exports`. This is timing data and does not require rendering a video.

## Fragile points (each one broke a real job)

- **Never trim on STT token times.** They trail the real onsets by 0–0.4 s. Cutting on them clipped "Meet" off "Meet Fincredible". `produce.mjs` measures the lag and cuts inside real silences; keep it that way.
- **Takes of the same line vary a lot in pace.** Gemini pt-PT reads of one line ranged from 5.3 to 7.1 syllables per second of talking, and a reviewer called the 6+ ones "rushed". `produce.mjs` measures pace (syllables / articulation time) and penalises takes above `maxRate` (pt 5.5, en 5.0). For dense lines, add "speaking at a relaxed, measured pace" to the group `style` and `--regroup` it.
- **Soft word endings get clipped.** European Portuguese final vowels are often whispered. Trimming at the 3% gap threshold cut "terreno" to "treino". Phrases are trimmed with a lower threshold (`trimRel` 1.2%) and pads of 40/140 ms (`padIn`/`padOut`).
- **STT writes numbers as genderless digits.** "1 equipa" came back for "uma equipa". The checker treats um/uma, dois/duas and -entos/-entas as equal; add aliases for anything else (e.g. `["pra", "para"]`).
- **Words can be heard as other words once isolated.** "sistema testado" came back as "sistema de estado" in 2 of 3 takes. When a line fails, `produce.mjs` cuts and checks the next valid take of the group (`phraseTries`, default 3). If every take fails on the same word and script edits are authorized, reword with a synonym from the site ("validado"); otherwise preserve the wording and address pronunciation or takes.
- **Brand names get mangled.** "Fincredible" came out as "Incredible" in every voice until the TTS text said "Fin-credible". Always A/B the brand, and check it with STT that has no context bias. "Link&Grow" worked best as "Link and Grow"; a hyphenated "Link-and-Grow" was heard as "Lincoln Grow".
- **Gemini 3.8 reads the text verbatim.** Stage directions go in `style` (short, reused per scene), not in the text. Pauses use `<short pause>` or `<long pause>`, one key word per line can be in CAPS, and tags stay in English even in a pt-PT read.
- **Soniox tags are English square brackets.** Use `[warm]`, `[pause]`, and `*stress*` for emphasis. Limits: `speed` 0.7–1.3, 3 concurrent requests, 2 minutes of audio per request.
- **Voice Design voices persist.** They live in the user's Google project (1-year TTL, 200 max). List and reuse them before creating; never delete one without asking.
- **One-word hooks right after an impact sound are often lost.** "E se…" was unintelligible; "Imagina…" passed. Test hook alternatives through STT.
- **Mix targets.** Voice about 4 LU over the music bed, with sidechain ducking; master at −14 LUFS / −1 dBTP (`promo-motion-video` handles the mix).

## Report to the user

Include:
- the chosen voice and why (scores and metrics);
- the pronunciations that were fixed;
- per-line verification of the phrases and, when available, of the final mix;
- which keys were used, and which to rotate;
- a reminder to listen before publishing.
