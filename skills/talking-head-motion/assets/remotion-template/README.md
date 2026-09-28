# Talking-head motion starter

Demonstração vertical de 16 s, 720×1280 a 30 fps, sem media ou voz incluídos. **Substituir os dados**: as legendas são sintéticas, não uma transcrição.

Copiar esta pasta para um projeto de trabalho. Requer Node.js 20+; a primeira renderização pode descarregar o browser. No PowerShell:

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run studio
npm.cmd run still -- --frame=270
npm.cmd run render
```

Editar `timeline.example.json`: metadados; `clips` com caminhos relativos a `public/` e offsets em frames; `captions` com tempos em ms da montagem final; `scenes`; `theme`. Colocar o vídeo em `public/source.mp4` e definir `src: "source.mp4"`. `src: ""` mantém o placeholder.

Cenas: `hook`, `upload`, `prompt`, `steps`, `emphasis`, `cta`. `steps` aceita 1–6 `items` e `stepFrames` relativos; `hideCaptions` é opcional. CTA aceita `endTitle`/`endBody` para o cartão final. Usar cenas CTA com pelo menos 36 frames.

Os pacotes Remotion estão fixados em 4.0.529 e o lockfile está incluído. O áudio original acompanha o vídeo; fontes de sistema podem variar entre máquinas. O render não aplica tratamento de voz automaticamente.

Contrato completo, remapeamento e uso: [guia da skill](../../references/remotion-guide.md). Tipos e validação: `src/types.ts`.
