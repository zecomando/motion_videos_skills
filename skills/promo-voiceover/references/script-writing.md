# Writing the voice-over script

## Facts and claims

- **Source every claim.** Take every number, client name, product name, slogan and promise from the brand's own pages (`research/text.txt`, `research/pages/*.txt`), and keep a list of each fact with its source page.
- **Invent nothing.** No new metrics, awards, cities or guarantees.
- **Illustrative data.** Numbers shown in UI mock-ups are illustrative; say so in the report.
- **Copy the brand's voice:**
  - its form of address: pt-PT sites use "tu" or "você"; keep the same one throughout;
  - its own vocabulary;
  - its official slogan, used verbatim at least once.

## Structure (VO-led)

| Length | Beats (approximate) |
|---|---|
| 30 s | hook 0–4 · brand 4–8 · 2–3 value beats 8–22 · proof 22–26 · CTA 26–30 |
| 45 s | hook 0–6 · brand 6–10 · value beats 10–31 · proof 31–36 · CTA 36–45 |
| 60 s | the 45 s shape with one more value beat and a longer proof |

- **Hook:** tension, a pain point or a question in the viewer's world. Keep it very short, and make the first words intelligible over the music.
- **Brand:** the name plus the slogan.
- **Value beats:** benefit before feature. One idea per beat, echoed by one headline on screen.
- **Proof:** real numbers, real clients, a real review.
- **CTA:**
  - one action, with the brand's own CTA wording;
  - the URL said once and shown on screen;
  - the last line should make the viewer want to act (inspiration plus a low-friction next step).

## Voice vs screen

- **Echo or complement, never compete.** When big text is on screen, the voice says the same thing (or nearly), or stays silent. A competing sentence splits attention. Over UI demos with little text, the voice can add information.
- **Let it breathe.** Keep the voice off:
  - impacts, music drops and logo reveals;
  - the first 0.5 s after a drop.

  Each line ends at least 0.2 s before its scene changes.
- **One group per scene.** It is read in one take for natural flow. A new group means a new scene.

## Pace

| Language | Comfortable | Maximum |
|---|---|---|
| pt-PT | 4–4.5 syllables/s | 5 syllables/s |
| English | 2.6–3.2 words/s | 3.5 words/s |

- **Count before generating.** Count syllables or words per line, and budget each scene for them.
- **Check after generating.** `produce.mjs` prints each take's articulation rate (syllables per second of talking, pauses excluded) and prefers takes at or below `maxRate` (pt 5.5).
- **Short sentences.** Use active verbs and concrete nouns. Take out the adverbs.

## European Portuguese (pt-PT)

- **Use:** equipa, connosco, registo, telemóvel, ecrã, "estamos a fazer" (not the gerund), "fazê-lo", contacto, facto.
- **Avoid:** equipe, time (for team), a gente, legal, cadastro, tela, celular, gerund progressives, and "você" where the brand says "tu".
- **Brand names and English words:** keep them English on screen, and test their spoken form (`pron`).
- **Numbers and symbols:** write them as words in the TTS text ("mais de dezoito anos", "duzentos e quarenta", "vinte e quatro horas").
- **URL:** say it the way a Portuguese announcer would ("… ponto com"). Add aliases in `vo.json` so the checks accept both "ponto com" and ".com".

## vo.json fields

| Field | What it holds |
|---|---|
| `brief` | One paragraph: product, audience, tone, voice identity. The AI ears read it. |
| `language` | e.g. `pt-PT` or `en-GB` |
| `provider` | `gemini` or `soniox` |
| `voice` | Set after casting |
| `style` | Default delivery (Gemini): a short English phrase such as "confident, energetic, warm commercial read". |
| `groups[]` | Each group: `{ id, style?, lines: [{ id, text, tts? }] }`. `text` is what must be heard (and usually shown); `tts` is an optional spelling for synthesis. |
| `required` | Normalised phrases that must be heard in every take that contains them (brand name). |
| `aliases` | `[from, to]` normalised pairs, e.g. `["wildtheory", "wild theory"]` or `["ponto com", "com"]`. |
| `pron[]` | `{ id, canonical, variants, line: "… {X} …", expect }`. The winner replaces `canonical` in TTS text. |
| `casting` | `{ text, style, takes, candidates: [ids], designs: [{ key, gender, description }] }` |
| `maxPause` | Optional. Shortens pauses inside a phrase, e.g. `0.35` keeps them at `keepPause`. |
| `maxRate` | Pace limit in syllables per second of talking (default pt 5.5, en 5.0); faster takes are penalised |
| `lineGap`, `sceneGap` | Spacing used by `assemble.mjs --suggest` |
