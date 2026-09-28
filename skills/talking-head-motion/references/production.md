# Preparar e editar uma gravação

## Ambiente

O helper requer Python, FFmpeg/FFprobe acessíveis no PATH e Pillow para folhas de contacto. A transcrição local é opcional e usa `faster-whisper`. A base Remotion requer Node.js/npm. Verificar o que já existe e reutilizar o ambiente do projeto; não instalar ferramentas sem necessidade.

Quando faltarem dependências Python, criar um ambiente no projeto de edição, sem colocar ambientes virtuais dentro da skill:

```powershell
python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install pillow faster-whisper
```

Os comandos seguintes usam `python` como o interpretador desse ambiente. Ajustar para o caminho completo quando necessário. O primeiro uso de um modelo ASR pode descarregá-lo; a transcrição é executada localmente. Escolher modelo multilingue para português e `task=transcribe` para preservar o idioma; modelos `.en` destinam-se a inglês.

## Inspeção

Usar o caminho real da pasta da skill em `$skillDir` e uma pasta nova para os resultados. O exemplo seguinte parte da raiz deste repositório; se a skill estiver instalada noutro local, usar a pasta onde está o seu `SKILL.md`:

```powershell
$skillDir = (Resolve-Path './skills/talking-head-motion').Path
python "$skillDir\scripts\prepare_media.py" inspect "source.mp4" --out "analysis"
```

Consultar `--help` para opções e ficheiros de saída. O helper não altera a fonte. Inspecionar a folha de contacto e os metadados; ampliar frames de texto pequeno e assistir ao trecho das transições quando amostras estáticas não forem suficientes.

A inspeção produz `ffprobe.json`, `inspection.json` e `contact-sheet-001.jpg` (com mais páginas conforme necessário). Por omissão, não sobrescreve resultados existentes; escolher nova pasta ou usar `--force` quando essa substituição for pretendida.

Alternativa mínima sem helper:

```powershell
ffprobe -v error -show_format -show_streams -of json "source.mp4"
ffmpeg -n -i "source.mp4" -vn -ac 1 -ar 16000 -c:a pcm_s16le "speech.wav"
```

Verificar rotação, proporção, FPS variável, duração e presença de áudio. Normalizar FPS apenas se o material causar problemas de sincronização, mantendo uma cópia do original.

## Transcrição e correção

```powershell
python "$skillDir\scripts\prepare_media.py" transcribe "source.mp4" --out "transcript" --language pt --model small
```

`small` é um ponto de partida, não uma garantia de qualidade. Rever contra o áudio nomes próprios, números, nomes de ferramentas, palavras rápidas e pausas. Se a confiança for insuficiente, corrigir o texto e realinhar o trecho; não distribuir automaticamente palavras por durações iguais e apresentar isso como sincronização real.

O resultado fica em `transcript/transcript.json` e `transcript/transcript.txt`. Acrescentar `--local-files-only` para usar apenas um modelo já descarregado. Para converter as palavras em milissegundos para Remotion:

```powershell
python "$skillDir\scripts\prepare_media.py" captions "transcript\transcript.json" --out "caption-data"
```

O ficheiro `caption-data/captions.json` contém um array com `text`, `startMs`, `endMs`, `timestampMs` e `confidence`. Copiar esse array para `captions` da timeline, depois de remapear se houve cortes. O helper conserva os espaços da transcrição; se a origem não os incluir, normalizar separação entre palavras sem alterar números/pontuação.

O ASR pode devolver palavras com início igual ao fim, mesmo com confiança alta; isso aconteceu nesta referência. O conversor recusa palavras sem duração positiva, incluindo valores que colapsem ao arredondar para milissegundos. Rever e alinhar esses casos num trecho de áudio e guardar uma transcrição corrigida antes de converter; não apagar a palavra nem fabricar uma duração uniforme só para passar a validação.

Para recuperar um alinhamento local, extrair um trecho com contexto antes e depois da palavra e voltar a transcrevê-lo, eventualmente com um modelo multilingue maior já disponível. Por exemplo, um trecho que começa aos 35 s:

```powershell
ffmpeg -n -ss 35 -i "source.mp4" -t 5 -vn -ac 1 -ar 16000 "alignment-fragment.wav"
```

Os novos tempos desse trecho são relativos a zero; somar 35 segundos antes de os integrar na transcrição da fonte. Comparar com a fala e substituir apenas o trecho revisto. Se continuar ambíguo, usar alinhamento forçado disponível ou marcar o trecho para revisão; não esconder a incerteza com tempos artificiais.

Conservar texto literal e tempos da fonte. Para correções, guardar a saída bruta e uma cópia editorial corrigida. A grafia da legenda pode ser ajustada, mas não transformar uma afirmação incerta num facto.

## Plano editorial

Uma tabela curta é suficiente:

| Início/fim na saída | Fala ou ideia | Tratamento | Texto gráfico |
|---|---|---|---|
| Segundo a frase | Afirmação principal | Título em duas linhas | Síntese fiel |
| Segundo a demonstração | Envio/instrução | Ficheiro e prompt | Dados reais ou ilustração neutra |
| Segundo a explicação | Etapas de um processo | Painel + inset | Passos curtos |
| Segundo a ênfase | Reação forte | Palavra de impacto | Palavra dita |
| Segundo o fecho | Próxima ação | CTA e wipe | Ação pretendida |

Adaptar a duração ao discurso. Não esticar uma gravação curta até à duração de 57 segundos da referência. Uma edição pode usar apenas legendas e um título se isso cumprir o pedido.

## Cortes e relógios

Começar com velocidade 1×. Guardar para cada clip: ficheiro, início na saída, início na fonte e duração. Todos os frames da timeline usam o FPS da composição, mesmo que a fonte tenha FPS diferente.

Para mapear uma palavra da fonte para um corte, em milissegundos:

```text
a = sourceStartFrame / fps * 1000
b = (sourceStartFrame + durationInFrames) / fps * 1000
o = fromFrame / fps * 1000
inicio = max(wordStartMs, a)
fim = min(wordEndMs, b)
se fim > inicio:
    outputStartMs = o + inicio - a
    outputEndMs   = o + fim - a
```

Descartar palavras sem interseção. Se um corte atravessa uma palavra, rever editorialmente o corte: truncar os tempos não repara a fala cortada. Se o mesmo trecho é repetido, as palavras correspondentes também aparecem em cada repetição. Mudanças de velocidade exigem outro mapeamento; não as adicionar sem atualizar áudio, legendas e duração.

No template, as legendas fornecidas já devem estar no relógio da **saída**. O helper de conversão de legendas não faz decisões editoriais nem substitui este remapeamento.

## Áudio

Preservar a voz original. O vídeo Remotion já pode reproduzir o áudio do ficheiro; uma faixa WAV adicional sem silenciar esse vídeo duplica a voz. Aplicar os mesmos cortes às duas modalidades.

Música e efeitos não são necessários para reproduzir a composição visual. Acrescentá-los quando forem adequados ao pedido, com direitos de uso e sem encobrir a fala. Não alegar que a referência contém uma faixa específica sem ouvi-la e identificá-la.

Se for necessário normalizar volume, medir primeiro. Como ponto de partida para voz, pode usar-se `loudnorm`; os alvos dependem da entrega. Para valores precisos, usar duas passagens com os dados medidos, e não chamar «normalização verificada» a uma aplicação cega do filtro. Documentação: [FFmpeg loudnorm](https://www.ffmpeg.org/ffmpeg-filters.html#loudnorm).

## Exportação

Seguir o [guia Remotion](remotion-guide.md), verificar o [resultado](verification.md) e entregar os caminhos reais. Exportar em H.264/MP4 com áudio AAC e `yuv420p` quando for desejada compatibilidade ampla. Manter o projeto, os media necessários e os dados de timeline editáveis.

Fontes técnicas: [FFprobe](https://ffmpeg.org/ffprobe.html), [FFmpeg](https://ffmpeg.org/ffmpeg.html), [faster-whisper](https://github.com/SYSTRAN/faster-whisper), [Whisper](https://github.com/openai/whisper).
