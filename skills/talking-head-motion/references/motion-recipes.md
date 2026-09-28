# Receitas visuais

Os intervalos descrevem a referência; os parâmetros de produção abaixo são propostas ajustáveis. `W`, `H` e `fps` representam a composição de saída. Para adaptar dimensões de uma base 1080×1920, multiplicar medidas horizontais por `W/1080` e verticais por `H/1920`.

## Sistema visual

| Elemento | Proposta de implementação |
|---|---|
| Fundo gráfico | Carvão quase preto, por exemplo `#10140B` |
| Acento | Lima, por exemplo `#C4F044` |
| Texto | Branco quente `#F7F8F0`; preto no acento |
| Títulos e legendas | Fonte condensada pesada, maiúsculas; uma família como Anton/Oswald é alternativa, não identificação da original |
| Interface | Sans simples e legível, peso médio |
| Texto secundário expressivo | Serifada itálica em tamanho menor |
| Contorno | Preto, suficiente para separar a legenda da imagem, sem fechar os espaços internos das letras |

Escolher fontes locais licenciadas e empacotá-las quando for necessária consistência entre máquinas. Medir o texto com a fonte carregada. A base técnica usa fontes do sistema e requer afinação tipográfica para uma reprodução mais fiel.

## 1. Legendas por palavra

**Observado:** grupos curtos, geralmente 2–6 palavras, texto branco e apenas a palavra ativa lima; posição habitual a cerca de 74–77% da altura.

Construir páginas por unidade de fala e largura, não por uma contagem rígida. Preservar pontuação e espaços. Usar uma ou duas linhas, evitando que uma palavra isolada forme uma segunda linha desnecessária. Calcular palavra ativa por `start <= tempo < end`; durante uma pausa pode não existir palavra ativa.

No painel, manter a legenda numa camada independente e aproximadamente a 81–84% de `H`, com largura suficiente para ultrapassar o vídeo pequeno. Não inserir a legenda dentro da transformação que reduz o vídeo. Evitar deixá-la na imagem durante pausas longas.

Verificar o texto sobre cabelo, roupa, mãos e fundo claro; considerar as áreas ocupadas pela interface da rede social escolhida. A posição da referência não é uma garantia universal de zona segura.

## 2. Título de abertura

Usar uma etiqueta pequena, seguida de uma afirmação em duas linhas. Colocar a primeira em branco e a ideia principal na cor de acento. Entradas propostas: 6–12 frames com opacidade e pequena translação/escala, separadas por 2–4 frames. Manter o bloco acima dos olhos.

Mostrar apenas afirmações sustentadas pelo conteúdo. O título da referência que atribui a edição a um modelo não deve tornar-se texto padrão.

## 3. Cartão de upload ou ficheiro

Criar um mockup escuro no topo, com 86–90% de `W`: cabeçalho pequeno, cartão de ficheiro à direita, nome curto, ícone e barra. Revelar uma mensagem secundária depois do cartão. Usar uma barra determinista calculada pelo frame.

Tratar o elemento como ilustração. Para representar uma aplicação real com precisão, usar o aspeto e dados verificados dessa aplicação; não inventar estados de processamento nem logótipos.

## 4. Prompt digitado

Composição aproximada da referência: `x=6%W`, `y=9%H`, largura `89%W`, altura `21%H`; fundo preto translúcido, contorno fino lima, cantos arredondados, etiqueta e botão de envio no canto inferior direito.

Para acompanhar a fala, revelar palavras pelos tempos reais da frase. Para uma simulação breve de digitação, revelar caracteres com base no frame, sem `setTimeout`; em português usar segmentação que preserve caracteres Unicode. O espaço do card deve acomodar o texto completo desde o início, evitando saltos de altura.

Destacar uma expressão-chave com fundo lima e texto preto. O cursor pode piscar por uma função de frames. Ao terminar, acender o botão; se não houve envio real, o estado é apenas animação. Durante o prompt, esconder a legenda que repete exatamente o mesmo conteúdo.

## 5. Transição para painel explicativo

Animar o retângulo do vídeo entre ecrã inteiro e `x≈22%W`, `y≈39%H`, largura `56%W`, altura `56%H`, mantendo a proporção. Proposta inicial: transição de 12–20 frames com desaceleração suave. Acrescentar raio de canto e borda durante a transformação.

Manter uma única reprodução de vídeo/áudio sempre que possível. Não iniciar de novo o ficheiro ao entrar no inset. Se usar cópias para uma transição, calcular os mesmos offsets e deixar apenas uma faixa de áudio ativa.

Por trás, usar fundo carvão com brilho verde e textura discreta. O grafismo deve continuar legível sem depender dessa textura. Colocar título pequeno perto de `10%H` e quatro linhas entre cerca de `12–35%H`.

## 6. Processo progressivo

Cada linha tem número, título e uma descrição curta. Guardar o instante de ativação de cada passo na timeline. Antes dele: oculto ou discreto; durante: borda e acento; depois: visto de conclusão e menor destaque. Avançar segundo a fala, não dividir o tempo igualmente por conveniência.

Exemplo genérico: **analisar → transcrever → editar → exportar**. Alterar nomes e quantidade conforme o conteúdo real. A faixa de síntese pode aparecer depois do último passo, com ligeira inclinação e uma frase curta.

Um contador de renderização ilustrativo deve ser identificado como tal ou omitido. Para contar frames reais, usar metadados da composição/ficheiro, não os números vistos na referência.

## 7. Zoom e palavra de impacto

Separar zoom da imagem e escala da tipografia. Para um punch-in discreto, começar com escala de vídeo entre `1.00` e `1.08`, ancorada no rosto; ajustar à resolução e ao gesto. A referência não fornece os valores originais de zoom.

Na palavra de reação, usar texto muito grande, uma cópia preenchida e outra de contorno ligeiramente deslocada. Escala proposta: `0.75 → 1.12 → 1.00`, com um pico breve. O recorte lateral é intencional neste efeito, mas é erro em legendas informativas. Um brilho breve é opcional; o ficheiro sugere clareamento, sem permitir determinar o filtro.

Não aplicar tremores, flashes ou overshoot a todas as frases. Recuperar um enquadramento calmo depois do pico.

## 8. Contraste tipográfico e recapitulação

Combinar uma frase curta serifada itálica com uma conclusão condensada maior. Para a equação visual, construir três estados mantendo os anteriores: **ingredientes → ação → resultado**. Usar setas e pequenos ícones como suporte; o resultado recebe o maior peso e a cor de acento.

Não reduzir o rosto para acomodar uma frase longa. Encurtar o grafismo preservando a fala e reservar a explicação extensa para a legenda ou painel.

## 9. CTA e cartão final

Pergunta grande no topo, complemento itálico menor e uma ou duas ações em pílulas. Usar apenas ações adequadas ao objetivo do vídeo. Não copiar o handle nem a assinatura da referência.

Animar um retângulo de acento da base até cobrir o quadro. Proposta: 10–18 frames. Quando cobrir o vídeo, mostrar texto preto central e uma linha secundária. Fazer o último frame durar o suficiente para leitura e verificar que áudio/fala não são cortados pelo fim visual.

## Tradução para outro editor

Os mesmos elementos podem ser implementados com camadas de vídeo, texto, máscaras, keyframes de posição/escala/opacidade, contornos, estados de cards e uma faixa de áudio sincronizada. Se o utilizador escolher um editor específico, conservar esse editor e traduzir as receitas; a referência não obriga a Remotion. Verificar as funcionalidades da versão disponível em vez de inventar nomes de menus.
