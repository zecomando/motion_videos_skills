# Análise da referência

## Fonte e método

- Ficheiro: `ssstwitter.com_1790514534964.mp4`, fornecido pelo utilizador.
- SHA-256: `12f1413a22012dbb26d9c20db10a456551a98b18ebe3141de0cf358f0a87cadb`.
- Medido com FFprobe: vídeo H.264, 320×568, 30 fps, 1 716 frames, 57,200 s; áudio AAC mono, 44 100 Hz, 57,353 s; 1 776 778 bytes.
- O formato é aproximadamente 9:16; as dimensões reais não são exatamente 9:16.
- Inspeção visual: 114 amostras a 2 fps, folhas de contacto e frames ampliados. Os limites abaixo são aproximados, com resolução visual de cerca de 0,5 s; não constituem uma lista de cortes exata.
- Transcrição integral processada localmente com faster-whisper `small`, português e tempos por palavra. [Texto e limitações da transcrição](transcript.md). O texto foi comparado com as legendas visíveis; não foi feita uma revisão auditiva humana.
- [Storyboard com tempos](storyboard.jpg). As imagens são evidência da referência, não assets para incorporar automaticamente em novos vídeos.

## O que o vídeo ensina

Uma gravação contínua pode ganhar estrutura editorial através de transcrição, grafismos calculados no tempo e renderização. O próprio exemplo mostra a instrução do apresentador: editar o vídeo, demonstrar motion e explicar visualmente como o processo foi feito.

O painel atribui a inspeção a FFmpeg, a transcrição a Whisper e os grafismos a React/Remotion. São alegações apresentadas pelo vídeo; não há código-fonte ou registo de execução para provar o pipeline original. A implementação desta skill usa um processo compatível, verificado separadamente.

O nome de modelo, a identidade do autor, o nome de ficheiro mostrado na interface e os créditos são conteúdo particular da peça. Não copiar estes elementos para outros trabalhos. O contador animado de frames não substitui uma medição: o ficheiro fornecido tem 1 716 frames de vídeo.

## Mapa temporal

| Intervalo aproximado | O que se vê | Aplicação |
|---|---|---|
| 0–2 s | Rosto em ecrã inteiro; legenda branca com palavra lima | Começar diretamente pela fala |
| 2–6 s | Etiqueta pequena e título superior branco/lima | Mostrar a afirmação principal |
| 6–7,5 s | Rosto e legendas habituais | Intervalo visual de respiração |
| 7,5–12,5 s | Mockup de conversa, cartão de ficheiro e progresso | Ilustrar o envio de um ficheiro |
| 12,5–14,5 s | Caixa de prompt em espera | Introduzir a instrução |
| 14,5–22,5 s | Texto do prompt revelado; expressão destacada; botão de envio | Tornar a fala visível como comando |
| 22,5–23 s | Vídeo contrai-se e desce | Abrir espaço para explicação |
| 23–25,5 s | Painel escuro com título; vídeo inset | Estabelecer a nova composição |
| 25,5–28 s | Passo 1 ativo | Iniciar a explicação progressiva |
| 28–32 s | Passo 2 ativo; anterior concluído | Mostrar avanço |
| 32–34,5 s | Passo 3 ativo | Introduzir edição em código |
| 34,5–36 s | Passo 4 ativo | Introduzir renderização |
| 36–40,5 s | Faixa lima de síntese abaixo dos passos | Resumir o processo |
| 40,5–41 s | Rosto regressa ao ecrã inteiro | Retomar contacto direto |
| 42,5–44 s | Palavra de reação cresce; cópia de contorno e breve clareamento aparente | Pico expressivo |
| 44,5–46 s | Rosto e legenda | Recuperação após o destaque |
| 46–48 s | Pequena frase serifada itálica e título lima | Contraste tipográfico |
| 48,5–52,5 s | Equação construída: ingredientes, ação, resultado | Recapitular em três momentos |
| 52,5–55,5 s | Pergunta grande, subtítulo itálico e duas pílulas de ação | Chamada à participação |
| 55,5–56 s | Wipe lima ascendente | Passagem para assinatura |
| 56–57,2 s | Cartão final lima com texto preto | Fecho |

## O que não é possível deduzir do ficheiro

Não se identifica com certeza a família tipográfica, os valores hexadecimais originais, as curvas de animação, os prompts internos, a organização do projeto ou o modelo usado. A baixa resolução limita a leitura de microtexto. Valores de cor, posição e duração sugeridos nas receitas são aproximações para implementação, não parâmetros recuperados do projeto original.

Não confundir alterações de tamanho e enquadramento com novos planos de câmara. Não afirmar remoção de silêncios ou tratamento de áudio sem evidência específica.
