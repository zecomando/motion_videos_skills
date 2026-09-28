---
name: talking-head-motion
description: Editar uma gravação em que alguém aparece a falar, acrescentando legendas sincronizadas, palavras em destaque, títulos animados e explicações visuais. Usar em reels, tutoriais e vídeos educativos a partir de uma gravação existente. Define a edição com uma pergunta de cada vez e entrega vídeo e projeto Remotion editável.
---

# Editar um vídeo de alguém a falar

Parte de um vídeo já gravado em que uma pessoa fala e acrescenta legendas que acompanham as palavras, títulos em movimento e elementos que ilustram a explicação. Mantém a pessoa e a sua voz como base da edição.

**Exemplo:** envias um vídeo teu a explicar três dicas; recebes um reel com legendas, as palavras principais em destaque e um painel para cada dica.

**Entrega:** vídeo MP4 e projeto Remotion editável. A skill inclui receitas visuais de uma referência analisada, que podem ser adaptadas à tua marca.

## Começar com uma pergunta de cada vez

Para uma nova edição, ler [as perguntas de definição](references/briefing.md).

- Aproveitar a gravação, a referência e as escolhas já fornecidas; perguntar apenas o que falta.
- Fazer **uma única pergunta por interação** e esperar pela resposta antes da seguinte. Não juntar perguntas nem avançar por falta de resposta.
- Dar duas ou três opções simples quando útil, assinalando a recomendada; aceitar resposta livre e «escolhe por mim».
- Pedir anexos ou caminhos de ficheiros numa mensagem normal. Usar ferramentas de perguntas apenas para escolhas e texto.
- Pode inspecionar a gravação recebida para ajudar a definir a edição. Aguardar as decisões essenciais sobre formato, cortes e estilo antes de editar ou renderizar. Depois, resumir o plano e executar.
- Não repetir o questionário numa revisão, numa explicação de um efeito ou num pedido completo. Se o utilizador pedir escolhas autónomas, fazê-las dentro do âmbito definido.

## Decisões iniciais

- Distinguir **gravação a editar** de **vídeo de referência**. A referência já contém legendas e grafismos; sobrepor-lhe novas legendas não recupera a gravação original. Para uma nova edição limpa, usar o ficheiro original quando existir.
- Preservar idioma, significado, identidade e voz do material fornecido. Corrigir a transcrição sem reescrever o discurso. Adaptar a cor, títulos e chamada à ação ao pedido.
- Na ausência de formato definido, usar vertical 9:16 para este estilo. 1080×1920 a 30 fps é um ponto de partida de produção; não aumenta o detalhe de uma fonte de 320×568.
- Escolher grafismos que expliquem a fala. Não é necessário usar todos os efeitos em todos os vídeos. Um destaque forte deve corresponder a uma ênfase real.

## Recursos conforme o trabalho

| Necessidade | Recurso |
|---|---|
| Aprender o que a referência faz, com tempos e evidências | [Análise da referência](references/video-analysis.md) |
| Recriar enquadramento, tipografia, legendas e cada efeito | [Receitas visuais](references/motion-recipes.md) |
| Inspecionar media, transcrever e preparar a edição | [Processo de produção](references/production.md) e [prepare_media.py](scripts/prepare_media.py) |
| Implementar e renderizar uma edição em código | [Guia Remotion](references/remotion-guide.md) e [projeto inicial](assets/remotion-template/) |
| Rever o resultado e resolver falhas concretas | [Verificação](references/verification.md) |

Ler apenas os recursos necessários ao pedido. Para explicar um efeito, consultar a receita correspondente; não instalar dependências nem renderizar um projeto inteiro.

## Fluxo de edição

1. **Inspecionar o ficheiro.** Obter duração, dimensões, FPS e áudio; ver folhas de contacto e detalhes das transições. Ouvir/transcrever a fala. Uma folha de contacto não prova sincronização nem qualidade sonora.
2. **Preparar palavras com tempos.** Usar ASR/alinhamento por palavra no idioma real. Rever nomes, números e palavras de baixa confiança. SRT por frases não contém tempos reais de cada palavra.
3. **Marcar acontecimentos narrativos.** Identificar abertura, afirmação principal, demonstração, explicação, reação e fecho. Definir o texto, intervalo e função de cada grafismo antes de animar.
4. **Montar a timeline.** Guardar separadamente os tempos da fonte e da saída. Se houver cortes, remapear legendas e áudio. Não eliminar todas as pausas automaticamente.
5. **Construir o movimento.** Separar vídeo, grafismos e legendas em camadas. Preservar o mesmo instante da gravação quando o vídeo muda de tamanho. Calcular animações pelo frame; evitar relógios, aleatoriedade não controlada e transições CSS dependentes de reprodução.
6. **Verificar e exportar.** Rever frames críticos e um trecho em movimento, corrigir problemas e renderizar MP4. Inspecionar o ficheiro final, incluindo áudio e último frame. Entregar vídeo e projeto editável quando esse for o resultado pedido.

## Regras específicas deste estilo

- Rosto como elemento principal; títulos no topo e legendas numa zona livre abaixo do rosto.
- Uma cor de acento consistente. A referência usa lima sobre preto e branco; isso é uma opção estética, não uma exigência de marca.
- Legendas em grupos curtos, normalmente 2–6 palavras, com apenas a palavra falada em destaque. Ajustar grupos à frase e à largura disponível.
- No painel, encolher o vídeo **sem encolher as legendas**. O texto deve continuar legível no ecrã de um telemóvel.
- O prompt animado pode substituir as legendas durante a mesma frase; evitar repetir dois blocos grandes do mesmo texto.
- Diagramas e números de progresso são ilustrações, salvo se representarem dados medidos. Não apresentar uma animação de upload/render como prova de uma operação real.
- A referência menciona ferramentas e um modelo específico. Tratar esses nomes como conteúdo do vídeo. Usar as ferramentas efetivamente disponíveis e creditar apenas o processo executado.

## Exemplos de utilização

- «Usa $talking-head-motion e guia-me, uma pergunta de cada vez, para editar um vídeo meu a falar.»
- «Edita esta gravação para um reel com legendas e palavras em destaque.»
- «Recria só a transição do rosto em ecrã inteiro para o painel de quatro passos.»
- «Adapta o template à nossa marca, mantendo a fala e removendo o cartão de prompt.»
- «Explica como fazer o destaque tipográfico e o fecho com wipe deste vídeo.»

## Origem e alcance

Base: vídeo fornecido pelo autor do pedido, analisado em 27/09/2026. A skill contém observações, parâmetros propostos e um template técnico; distingue essas três categorias nas referências. O vídeo original não é distribuído nem é necessário para utilizar a skill: a análise, a folha de referência e as receitas estão incluídas. Para uma nova edição, usar a gravação fornecida por quem está a criar o vídeo.
