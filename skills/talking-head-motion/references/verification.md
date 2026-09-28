# Verificação e correções

Verificar de acordo com o que foi alterado. Depois de uma verificação bem-sucedida, repetir apenas as partes afetadas por novas alterações.

## Antes do render final

- Ver primeiro frame, título completo, prompt completo, transição para inset, último passo, palavra de impacto, CTA e último frame.
- Confirmar que fonte, acentos e caracteres portugueses são carregados; texto não sai dos cards nem tapa os olhos.
- No painel, confirmar continuidade do vídeo e tamanho independente das legendas.
- Rever em movimento uma passagem com fala, mudança de layout e destaque; imagens estáticas não validam áudio nem ritmo.
- Depois de cortes, comparar pelo menos o primeiro grupo de palavras, uma passagem posterior a um corte e o fim. Havendo erro, corrigir o mapeamento em vez de deslocar todas as legendas arbitrariamente.

## No ficheiro exportado

Usar FFprobe para verificar duração, dimensões, FPS e streams; reproduzir uma amostra com áudio e verificar o fecho. A duração do stream de áudio pode diferir ligeiramente da de vídeo por codificação; verificar que não há fala truncada, silêncio inesperado ou cauda sonora indesejada.

Não declarar verificação auditiva se apenas foram analisados metadados, formas de onda ou transcrição. Indicar qualquer limitação concreta de reprodução ou de leitura da fonte.

## Diagnóstico orientado pelo sintoma

| Sintoma | Causa provável | Correção |
|---|---|---|
| Voz com eco ou mais alta | Áudio do vídeo e WAV ativos | Silenciar uma das fontes e manter offsets iguais |
| Desfasamento que começa depois de um corte | Tempos da fonte usados na saída | Remapear palavras por clip |
| Vídeo recomeça quando encolhe | Nova reprodução iniciada a zero | Manter o vídeo montado ou aplicar offset correto |
| Legendas minúsculas no inset | Texto dentro da transformação do vídeo | Mover legendas para camada independente |
| Destaque de palavra incorreto | ASR/alinhamento incorreto ou relógio local | Rever tempos e usar relógio global da saída |
| Texto fica durante o silêncio | Página prolongada até à seguinte | Limitar permanência depois da última palavra |
| Prompt salta de posição/altura | Layout depende do texto parcial | Reservar o retângulo final antes da revelação |
| Texto diferente no render | Fonte indisponível ou carregamento tardio | Empacotar fonte licenciada e aguardar carregamento |
| Preview correto, render diferente | CSS transition, relógio ou aleatoriedade | Derivar estado exclusivamente do frame |
| Ficheiro não encontrado no Windows | Caminho absoluto passado a staticFile | Copiar para public e usar caminho relativo |
| JSON de props rejeitado | Aspas da shell ou esquema inválido | Passar caminho JSON e validar tipos/intervalos |
| Falha de versões Remotion | Pacotes @remotion/* desalinhados | Alinhar versões exatas e verificar instalação |
| Imagem suave a 1080×1920 | Fonte de baixa resolução | Preservar proporção; comunicar limite de detalhe |
| Fim preto ou truncado | Duração total incoerente | Comparar último clip, grafismos e duração da composição |

## Critério de conclusão

O resultado deve ter fala inteligível e contínua, legendas corretas e legíveis, grafismos relacionados com o conteúdo, transições sincronizadas e ficheiros que abrem. Créditos e descrição devem refletir o trabalho efetivamente executado. Um template que compila não comprova por si só a qualidade editorial de um novo vídeo.

## Verificação deste pacote — 27/09/2026

- Estrutura/frontmatter da skill validados; referências locais verificadas.
- Helper executado com o vídeo fornecido: inspeção, transcrição local e conversão de uma fixture com palavras portuguesas. Recusa de sobrescrita e de palavras sem duração testada; o ASR real revelou casos que exigem revisão de alinhamento.
- Template: TypeScript validado; dois trechos de 30 frames exportados em H.264, um com placeholder e outro com o MP4 original. O segundo contém áudio AAC; FFprobe confirmou 360×640 e 30 fps no teste reduzido.
- Frames de abertura, upload, prompt, painel, destaque e cartão final inspecionados visualmente. Avaliação independente confirmou o exemplo de corte e o painel de três passos.

Os renders foram feitos num projeto temporário; não há media original, dependências instaladas ou caches dentro da skill. Não foi produzida uma nova edição integral dos 57 segundos nem feita revisão auditiva do render; o pedido era criar a skill e verificar os seus recursos.
