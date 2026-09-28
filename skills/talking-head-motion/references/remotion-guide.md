# Implementação com Remotion

## Projeto inicial

Copiar [assets/remotion-template](../assets/remotion-template/) para uma **nova pasta de projeto**. Editar essa cópia; conservar a skill como recurso reutilizável. Se já existir um projeto Remotion, adaptar os componentes e dados a esse projeto em vez de substituir a sua estrutura.

O exemplo tem 16 segundos, 720×1280 e 30 fps. Usa dados de demonstração e um placeholder quando `clips[].src` está vazio. Não inclui uma gravação nem locução; as legendas de exemplo servem apenas para testar o mecanismo. Substituir vídeo, textos e tempos para produzir um trabalho real.

Na pasta copiada:

```powershell
npm ci
npm run check
npm run studio
```

`npm ci` usa o lockfile fornecido. O primeiro render pode descarregar o navegador usado pelo Remotion. Não colocar `node_modules`, cache ou renders dentro da pasta da skill.

## Ficheiros que se editam

| Ficheiro | Função |
|---|---|
| `timeline.example.json` | Formato, clips, palavras, cenas e cores |
| `src/TalkingHead.tsx` | Layout e animações |
| `src/types.ts` | Esquema e validação da timeline |
| `src/Root.tsx` | Metadados e composição `TalkingHead` |
| `public/` | Vídeos, áudio e fontes locais da edição |

Guardar a gravação em `public/source.mp4`; no JSON escrever `"src": "source.mp4"`. Não escrever um caminho Windows absoluto no `staticFile`. Subpastas de `public` usam caminhos como `media/source.mp4`.

## Dados da timeline

| Campo | Unidade / significado |
|---|---|
| `fps`, `width`, `height` | FPS e dimensões da composição |
| `durationInFrames` | Duração total em frames inteiros |
| `clips[].src` | Caminho relativo a `public/`; vazio só para demonstração |
| `clips[].fromFrame` | Primeiro frame do clip na saída |
| `clips[].sourceStartFrame` | Deslocamento da fonte, expresso no FPS da composição |
| `clips[].durationInFrames` | Quantidade de frames do clip, fim exclusivo |
| `clips[].volume` | Ganho linear de 0 a 1; não é LUFS |
| `captions[]` | Palavras com `text`, `startMs`, `endMs`, `timestampMs`, `confidence` |
| `scenes[]` | Grafismos com `kind`, `fromFrame`, `durationInFrames`, texto e opções |
| `theme` | `background`, `foreground`, `accent`, `fontFamily` |

`theme.demoLabel` é uma etiqueta opcional de demonstração; removê-la na edição real. Campos de cenas opcionais incluem `hideCaptions`, `stepFrames` no painel e `endTitle`/`endBody` no fecho.

Os clips e as cenas são faixas independentes. O starter espera intervalos ordenados sem sobreposição dentro de cada faixa; pode haver um clip sob uma cena. Lacunas de clips mostram o fundo. Uma sobreposição intencional exige alterar a composição/validação, não apenas forçar dados inválidos.

### Exemplo concreto de um corte

Gravação de 35 segundos; retirar a pausa entre 8 e 10 segundos; saída de 33 segundos, a 30 fps:

```json
{
  "fps": 30,
  "durationInFrames": 990,
  "clips": [
    {"src": "source.mp4", "fromFrame": 0, "sourceStartFrame": 0, "durationInFrames": 240, "volume": 1},
    {"src": "source.mp4", "fromFrame": 240, "sourceStartFrame": 300, "durationInFrames": 750, "volume": 1}
  ]
}
```

Este é um excerto de props, não substitui sozinho o JSON completo: conservar dimensões, cores, cenas e legendas válidas. Depois do corte, a palavra que começa aos 12 segundos da fonte aparece aos 10 segundos da saída. Remapear todas as palavras conforme [production.md](production.md#cortes-e-relógios).

Um painel aos 12–24 segundos da **saída** começa em `fromFrame: 360` e dura `360` frames. Esses segundos não são os 12–24 segundos da fonte após o corte.

### Cenas

- `hook`: título de abertura com entrada e aproximação discreta.
- `upload`: card de ficheiro com progresso ilustrativo.
- `prompt`: texto revelado progressivamente, calculado pelo frame. O exemplo é uma simulação de digitação; sincronização real com a locução exige usar os tempos das palavras.
- `steps`: painel progressivo com vídeo inset. Adaptar itens e instantes à fala; consultar o tipo `Scene` para os campos suportados pela versão do starter.
- `emphasis`: repetição/contorno de uma palavra ou frase curta.
- `cta`: pergunta/mensagem final e passagem para cartão de fecho.

No CTA, `title`/`body` são a mensagem inicial, `items` pode fornecer a recapitulação e `endTitle`/`endBody` definem o cartão final. O wipe sobe em 12 frames e reserva 24 frames para leitura no exemplo. Dar duração suficiente à cena e adaptar a permanência à quantidade de texto.

Para a equação de recapitulação, usar estados sucessivos de título/itens ou adaptar `SceneGraphics` segundo a [receita 8](motion-recipes.md#8-contraste-tipográfico-e-recapitulação). O starter mostra mecanismos; não é um editor visual com todas as opções prontas. Ajustar textos, estilos e tempos no componente faz parte da edição.

O painel aceita entre 1 e 6 itens. `stepFrames` define o início de cada passo em frames **relativos à cena**; tem de ter o mesmo comprimento de `items`, ser crescente e ficar dentro da duração. Sem esse campo, o exemplo distribui os passos pelo tempo; substituir essa conveniência por marcas da fala na produção.

```json
{
  "kind": "steps",
  "fromFrame": 360,
  "durationInFrames": 360,
  "title": "Três passos",
  "items": ["Preparar", "Demonstrar", "Concluir"],
  "stepFrames": [12, 132, 240]
}
```

Neste exemplo a 30 fps, os passos ativam-se aos 12,4 s, 16,4 s e 20 s da saída. A cena ocupa 12–24 s, incluindo as transições de layout. Usar `"hideCaptions": true` num prompt que já apresenta a mesma fala. Não esconder legendas de frases que não estão representadas no grafismo.

## Relógio e continuidade

`useCurrentFrame()` dentro de uma `Sequence` é relativo ao início dessa sequência. A faixa de legendas fica no nível global da composição e usa os timestamps da saída. Não subtrair duas vezes o início de uma cena.

`OffthreadVideo` recebe `trimBefore` para o offset da fonte. `Sequence` controla início e duração na saída. O mesmo componente de vídeo mantém-se montado durante mudanças de layout, evitando reinícios e duplicação de áudio.

`sourceStartFrame=90` a 30 fps significa 3 segundos de offset, mesmo que a gravação original tenha 60 fps. Para velocidades diferentes de 1×, atualizar explicitamente toda a lógica de mapeamento.

## Legendas

`createTikTokStyleCaptions` agrupa tokens. O parâmetro de agrupamento em milissegundos não assegura uma quantidade máxima de palavras nem que o texto caiba no ecrã. Rever as páginas, dividir frases longas e adequar fonte/largura.

Os tokens guardam espaços em `text`, por exemplo `" uma"`, `" palavra"`. Usar `whiteSpace: pre-wrap`. `fromMs`/`toMs` dos tokens da página são tempos da timeline; a palavra ativa cumpre `fromMs <= agora < toMs`. A implementação limita o prolongamento da página durante silêncios.

Para obter palavras via helper, ver [produção](production.md#transcrição-e-correção). Substituir as legendas fictícias do exemplo. Não usar uma transcrição de outro vídeo como se acompanhasse a nova gravação.

## Fontes, formato e fidelidade

O starter usa fontes do sistema. Para reprodução consistente e títulos condensados próximos da referência, incluir uma fonte licenciada em `public/fonts/` e carregar antes do render, por exemplo com `@remotion/fonts` da **mesma versão** dos restantes pacotes. Consultar [carregamento de fontes](https://www.remotion.dev/docs/fonts-api/load-font). A fonte exata do vídeo não foi identificada.

Para 1080×1920, mudar as dimensões no JSON e rever quebras de linha. Para horizontal, adaptar layout e safe areas; mudar apenas as dimensões não constitui uma composição horizontal concluída.

## Inspeção e render

```powershell
npm run still -- --frame=270
npm run render -- --frames=210-269 --scale=0.5
```

O primeiro comando gera uma imagem; o segundo renderiza apenas um trecho. Para ficheiros e props com nomes próprios, usar comandos explícitos e saídas distintas:

```powershell
npx remotion still src/index.ts TalkingHead out/painel.png --frame=270 --props=timeline.example.json
npx remotion render src/index.ts TalkingHead out/preview.mp4 --props=timeline.example.json --frames=210-269 --scale=0.5 --codec=h264 --pixel-format=yuv420p
npx remotion render src/index.ts TalkingHead out/final.mp4 --props=timeline.example.json --codec=h264 --pixel-format=yuv420p
ffprobe -v error -show_format -show_streams -of json "out/final.mp4"
```

No Windows, passar o ficheiro JSON em `--props`, evitando problemas de aspas de JSON inline. Um trecho renderizado não é o vídeo completo. Fazer a [verificação final](verification.md) antes de declarar a entrega concluída.

## Compatibilidade e fontes técnicas

O starter fixa Remotion e `@remotion/*` em `4.0.529`, disponível no registry consultado durante a criação. Manter as versões alinhadas; `npx remotion versions` ajuda a identificar divergências. Verificar APIs da versão instalada antes de incorporar exemplos de uma documentação mais recente.

`OffthreadVideo` é usado para render local. A documentação atual também apresenta `Video` de `@remotion/media`; uma migração não é necessária só para reproduzir esta receita.

- [Composition](https://www.remotion.dev/docs/composition) e [calculateMetadata](https://www.remotion.dev/docs/calculate-metadata)
- [Sequence](https://www.remotion.dev/docs/sequence) e [OffthreadVideo](https://www.remotion.dev/docs/offthreadvideo)
- [staticFile](https://www.remotion.dev/docs/staticfile)
- [Caption](https://www.remotion.dev/docs/captions/caption) e [createTikTokStyleCaptions](https://www.remotion.dev/docs/captions/create-tiktok-style-captions)
- [Render CLI](https://www.remotion.dev/docs/cli/render), [Still CLI](https://www.remotion.dev/docs/cli/still) e [Versions](https://www.remotion.dev/docs/cli/versions)
