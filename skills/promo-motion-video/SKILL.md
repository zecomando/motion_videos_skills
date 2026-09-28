---
name: promo-motion-video
description: Criar vídeos para divulgar uma marca, produto ou serviço a partir do seu site, com imagens, textos animados, música e narração opcional. Orienta a definição com uma pergunta de cada vez. Usar para anúncios, vídeos de marca e revisões de projetos feitos com esta skill; produção em JavaScript, Playwright e FFmpeg.
---

# Criar um vídeo de uma marca ou produto

Transforma o site de uma marca num vídeo que apresenta o que ela oferece e convida o público a agir. Combina a identidade da marca, imagens reais, frases curtas, animações, música e, quando escolhida, narração com voz de IA.

**Exemplo:** um vídeo de 30 segundos para divulgar um serviço no Instagram, com o logótipo, três benefícios e um convite para pedir informações.

**Entrega:** MP4 pronto a partilhar, guião e localização do projeto editável.

## Codex e Claude Code

Invocar com `$promo-motion-video` no Codex ou `/promo-motion-video` no Claude Code. Resolver scripts e referências a partir da pasta deste `SKILL.md`; criar e executar a produção na pasta do projeto do utilizador. Para recolher escolhas, usar a ferramenta de perguntas disponível ou uma mensagem normal e esperar pela resposta. O fluxo abaixo é comum aos dois assistentes.

## Começar com uma pergunta de cada vez

Para um novo vídeo, ler [as perguntas de definição](references/briefing.md) antes de produzir.

- Começar pela primeira informação em falta. Usar o que já foi dito, os ficheiros fornecidos e os factos encontrados no site para evitar perguntas repetidas.
- Fazer **uma única pergunta por interação** e esperar pela resposta antes da seguinte. Não juntar várias decisões na mesma pergunta nem avançar por falta de resposta.
- Apresentar duas ou três opções simples quando ajudarem e indicar a recomendada. Aceitar respostas livres, incluindo «escolhe por mim», que delega essa escolha.
- Enquanto houver uma escolha essencial pendente, pode pesquisar o site recebido, mas não gerar narração nem renderizar o vídeo. Quando a definição estiver completa, resumir o plano em poucas linhas e executar o pedido.
- Ao usar `promo-voiceover`, passar as respostas já recolhidas; essa skill pergunta apenas o que ainda falta para a voz.
- Um pedido completo, uma correção ou uma explicação de um efeito não precisa de reiniciar o questionário. Respeitar pedidos explícitos para escolher autonomamente os detalhes em falta.

## Execução técnica

No video frameworks, no editors, no stock-music services. Everything is a web page seeked frame by frame, plus FFmpeg.

## Setup

- Run `node <this skill folder>/scripts/scaffold.mjs <project>`. It copies `project/` (and the sibling `promo-voiceover/narration/`) and keeps existing files. Keep both skills side by side in the same skills folder.
- Needs Node 20.6+ (use a supported LTS release), FFmpeg/ffprobe on PATH, and Playwright with Chromium (`npm i` in the project if no parent folder has it).
- Run every command from the project root.

## Workflow

1. **Research** — run `node research.mjs <url> --pages 8` (add `--focus word1,word2` for a topic-specific promo; brand subdomains such as marketing.brand.pt are followed; if the topic lives on a landing page, run research on that URL directly). Read `research/text.txt`, `research/pages/*.txt`, `research/info.json`, `hero.png`, `full.png` and `sheet.png`.
   - Write down the facts you may use (with their source page).
   - Copy the brand fonts, logo and photos into `assets/`.
   - Page videos are listed, not downloaded: fetch the useful ones and cut them with `frames.mjs`.
2. **Direction** — follow `references/design.md`:
   - tokens: colours, fonts, logo;
   - one brand motif;
   - beat structure;
   - on-screen copy (it echoes the voice).
3. **Voice, when requested** — follow the sibling [promo-voiceover skill](../promo-voiceover/SKILL.md), from script to `narration/phrases.json`, carrying over the completed brief.
   - `node narration/assemble.mjs --suggest` gives `CUES.vo`.
   - Set the scene times in `video/cues.js` around the voice.
   - Without narration, set scene times around the reading time and music; skip voice generation, assembly and voice intelligibility checks. Keep `CUES.vo` empty and ensure a previous project's `out/vo.wav` is not picked up by `mux.mjs`; preserve that audio separately if needed.
4. **Build** — edit `video/index.html` (tokens, scenes, overlays) and `video/main.js` (one function of t per scene, built on `video/engine.js`, see `references/engine.md`). With narration, reveal headline words with `rise(words, t, vo('vNN'))`; without narration, use explicit scene cue times instead of missing voice cues.
5. **Stills QA** — run `node render.mjs --stills <key times>` and read `out/sheet.png`. Fix every overlap, clipping, blur or empty frame before rendering.
6. **Render** — `node render.mjs` writes `out/video.mp4`; the frame count must print `(exact)`.
7. **Sound** — `node audio.mjs` writes `out/music.wav`; when there is narration, `node narration/assemble.mjs` writes `out/vo.wav`. Then run `node mux.mjs --web`. See `references/audio-mix.md`.
8. **Verify:**
   - `node check.mjs out/<name>-web.mp4`: frames, format, −14 LUFS, band balance, contact sheet. Look at the sheet.
   - With narration, `node --env-file=narration/.env narration/verify-mix.mjs out/<name>-web.mp4`: every VO line intelligible.
9. **Deliver** — copy the web version to the user's Downloads (Transferências) folder and send it, with the script and editable project path. Offer the master.

## Fragile points (each one broke a real job)

- **Every frame is a pure function of t.** No CSS animations or transitions, no clocks, no unseeded random. Workers render frames out of order.
- **Toggle scenes with `display`, not `visibility`.** Children with `visibility: visible` show through a hidden parent.
- **Serve the page over HTTP, never `file://`.** Masks, fetch and fonts get CORS-blocked. `render.mjs` does this.
- **JPEG q100 screenshots and one browser with several pages.** PNG is about 6× slower. Separate browsers contend for the GPU and stall. Screenshots that time out are retried, and the page is rebuilt after two failures.
- **No stream-copy splicing of partial re-renders for the final.** The frame count drifted (2702 instead of 2700). Re-render fully and check the count.
- **Inline SVGs share one stylesheet.** Two logos with the same `.cls-1` class repaint each other (the white logo turned the colour logo's blue "link" white on white). Prefix the classes per logo when inlining.
- **Facts only from the brand's site.** In one job, "founded in Amsterdam" was not supported by the site and had to go. Mock-up numbers are illustrative: say so.
- **Watch the flat-colour hold during wipes.** Anything over about 0.15 s reads as a glitch. Also check for overlapping cards (a review over a stat) and for text over busy footage without a scrim.
- **Report the verification actually performed.** If the available tools only provide stills, contact sheets, measurements and transcripts, state that limitation; these do not prove an audiovisual playback review. Ask the user to watch before publishing.

## Report to the user

Include:
- where the file is (Downloads), plus its length, resolution and size;
- the scene structure and the script;
- the sources of facts and media, and which data is illustrative;
- the checks that passed (frames, loudness, intelligibility);
- next options: alternate voice, 9:16 cut, the master file.
