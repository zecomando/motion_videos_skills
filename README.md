# Motion Videos Skills

Três skills para criar e editar vídeos com **Codex ou Claude Code**. Cada uma começa por fazer **uma pergunta de cada vez**, aproveita o que já explicaste e avança quando o trabalho estiver definido.

| Quero… | Skill | O que preciso de fornecer |
|---|---|---|
| Criar um vídeo de uma marca ou produto | `promo-motion-video` — imagens, textos animados, música e voz opcional | O site da marca ou do produto |
| Criar narração com voz de IA | `promo-voiceover` — guião, escolha de voz e áudio WAV | Um texto ou uma ideia para o guião; acesso ao serviço de voz |
| Editar um vídeo de alguém a falar | `talking-head-motion` — legendas, palavras em destaque e animações explicativas | A gravação original que queres editar |

As skills incluem instruções, scripts e modelos de projeto. Os dois assistentes usam os mesmos recursos; a produção é feita no computador onde o assistente está a trabalhar. Não precisas do computador nem dos ficheiros pessoais do autor.

## Começar, passo a passo

### 1. Escolher o assistente

Abre **Codex** ou **Claude Code** com a tua conta e escolhe uma pasta onde guardar os teus vídeos. Segue apenas a instalação correspondente ao assistente que vais usar.

- Codex: [guia oficial de início](https://developers.openai.com/codex/quickstart).
- Claude Code: [documentação oficial](https://code.claude.com/docs/en/overview).

### 2. Instalar as três skills

#### No Codex

Copia esta mensagem para o Codex:

```text
Usa o skill-installer para instalar as três skills de https://github.com/zecomando/motion_videos_skills, a partir das pastas skills/promo-motion-video, skills/promo-voiceover e skills/talking-head-motion. Instala as três lado a lado e confirma os nomes disponíveis. Se já houver versões instaladas, compara-as e preserva as minhas alterações locais ao atualizar.
```

O Codex pode instalar skills de repositórios GitHub através do instalador incluído. Se a skill não aparecer depois da instalação, reinicia o Codex. [Documentação oficial](https://learn.chatgpt.com/docs/build-skills).

#### No Claude Code

Copia esta mensagem para o Claude Code:

```text
Instala as três skills de https://github.com/zecomando/motion_videos_skills para eu usar no Claude Code. Descarrega o repositório, lê o README e executa scripts/install-claude-code.mjs com Node.js. Se houver versões diferentes já instaladas, compara-as e preserva as minhas alterações locais ao atualizar. No fim, indica os três comandos para as usar.
```

Se preferires instalar pelo terminal, com Git e Node.js disponíveis:

```sh
git clone https://github.com/zecomando/motion_videos_skills.git
cd motion_videos_skills
node scripts/install-claude-code.mjs
```

Se já descarregaste o repositório, entra nessa pasta e executa apenas o último comando. O instalador copia as três pastas completas para `~/.claude/skills` — no Windows, a pasta `.claude/skills` dentro da tua pasta de utilizador. Ficam disponíveis em todos os projetos do Claude Code. Se não aparecerem, abre uma nova sessão. [Skills no Claude Code](https://code.claude.com/docs/en/skills).

Para instalar apenas num projeto, indica a sua pasta de skills: `node scripts/install-claude-code.mjs --dest "/caminho/do/projeto/.claude/skills"`. Substitui o caminho pelo do teu computador; podes usar `--dest` também para uma localização personalizada.

O instalador mantém cópias idênticas e para antes de copiar se encontrar uma versão diferente, para permitir comparar as alterações. Instala as skills; as ferramentas de produção são preparadas no passo 4.

Mantém `promo-motion-video` e `promo-voiceover` na mesma pasta de skills: o modelo de vídeo copia o módulo de narração da pasta vizinha.

### 3. Escolher o que queres fazer

Usa **um** destes comandos numa conversa no projeto onde vais trabalhar:

| O que queres fazer | Codex | Claude Code |
|---|---|---|
| Vídeo de uma marca ou produto | `Usa $promo-motion-video` | `/promo-motion-video` |
| Narração com voz de IA | `Usa $promo-voiceover` | `/promo-voiceover` |
| Editar uma gravação de alguém a falar | `Usa $talking-head-motion` | `/talking-head-motion` |

Podes acrescentar o pedido ao comando. Por exemplo, no Claude Code: `/promo-motion-video Quero um vídeo de 30 segundos para o Instagram. Guia-me com uma pergunta de cada vez.`

### 4. Responder às perguntas e preparar o computador

A skill pede o que faltar: site ou gravação, objetivo, formato, duração e estilo. Responde a cada pergunta; podes dizer «escolhe por mim» quando quiseres delegar uma preferência.

Na primeira utilização, pede também:

```text
Verifica os requisitos desta skill no meu computador e prepara as dependências em falta no projeto. Orienta-me na configuração local de credenciais, se forem necessárias.
```

As bibliotecas e os ficheiros do vídeo devem ficar no projeto de trabalho. A pasta da skill guarda os recursos reutilizáveis.

### 5. Criar e rever o resultado

Quando a definição e o ambiente estiverem prontos, o assistente produz o trabalho. O vídeo é entregue em MP4; a skill de narração entrega WAV. Pede ajustes na mesma conversa e vê/ouve o resultado antes de o publicares.

Exemplos de ajustes: «Aumenta as legendas», «Usa um tom mais calmo», «Faz uma versão vertical de 30 segundos».

O [guia de prompts](skills/PROMPTS-PARA-USAR-AS-SKILLS.md) explica cada opção com exemplos.

## Requisitos por tipo de trabalho

| Trabalho | Ferramentas locais | Serviços externos |
|---|---|---|
| Vídeo de marca sem narração | Node.js, FFmpeg/ffprobe, Playwright e Chromium | Acesso ao site e aos materiais da marca |
| Narração com voz de IA | Node.js e FFmpeg/ffprobe | Gemini e/ou Soniox, conforme a língua e a configuração |
| Gravação com legendas e animações | Node.js, Remotion, Python, FFmpeg/ffprobe e Pillow; `faster-whisper` para transcrição local | O modelo de transcrição pode ser descarregado na primeira utilização |

Usa uma versão LTS suportada de Node.js; para os comandos de narração, o mínimo técnico é **20.6**, que introduziu o carregamento de `.env` com `--env-file`. [Notas do Node.js](https://nodejs.org/en/blog/release/v20.6.0). Para os scripts Python, usa Python 3.10 ou superior com versões compatíveis das dependências.

O assistente deve consultar as instruções de cada skill para instalar as dependências do projeto. O modelo Remotion inclui versões fixadas e `package-lock.json`; a instalação usa `npm ci`. O projeto promocional usa `npm install` e Chromium do Playwright.

A instalação de ferramentas e os comandos de terminal devem ser adaptados ao sistema operativo. Alguns exemplos técnicos estão escritos para PowerShell; a execução completa em macOS e Linux ainda não foi verificada neste pacote.

## Configurar a narração

Cada pessoa usa as suas próprias credenciais. O acesso aos modelos e vozes configurados tem de estar disponível na conta que vai fazer o trabalho.

1. No projeto de vídeo ou áudio, copia `narration/.env.example` para `narration/.env`, se ainda não existir esse ficheiro.
2. Abre o ficheiro localmente e preenche `GEMINI_API_KEY` e/ou `SONIOX_API_KEY`, conforme o serviço escolhido.
3. Mantém as chaves no ficheiro local. O `.gitignore` exclui os ficheiros `.env`.

O modelo vazio está em [narration/.env.example](skills/promo-voiceover/narration/.env.example). Para português de Portugal, a skill está preparada para Gemini; Soniox pode fornecer transcrição com tempos por palavra. Sem Soniox, existe a alternativa de transcrição Gemini descrita na skill.

Consulta os serviços em [Google AI Studio](https://aistudio.google.com/) e [Soniox](https://soniox.com/). Os testes de narração e a geração de voz usam as contas configuradas; transferir o repositório não fornece credenciais nem acesso aos serviços.

## Alternativa: descarregar a pasta

Se preferires trabalhar diretamente com os ficheiros:

1. Neste repositório, escolhe **Code → Download ZIP** e extrai o ZIP.
2. Abre a pasta extraída como projeto no Codex ou no Claude Code.
3. Pede, por exemplo: «Lê e segue `skills/promo-motion-video/SKILL.md` para criar o meu vídeo, fazendo uma pergunta de cada vez.»

Esta opção usa diretamente o caminho do ficheiro. Para usar os comandos `$nome-da-skill` no Codex ou `/nome-da-skill` no Claude Code, instala as skills seguindo o passo 2. Também podes executar o instalador de Claude Code a partir da pasta extraída do ZIP.

## Atualizar

Pede ao assistente que usas:

```text
Compara as minhas três skills de Motion Videos com a versão mais recente de https://github.com/zecomando/motion_videos_skills. Atualiza as cópias instaladas neste assistente, preservando as minhas alterações locais e os projetos já criados.
```

O instalador de Claude Code não substitui versões diferentes automaticamente. O assistente deve comparar e integrar essas diferenças. A atualização dos recursos de uma skill não altera automaticamente os vídeos e projetos já criados.

## Compatibilidade

As três skills usam `SKILL.md`, com instruções e recursos relativos à sua própria pasta. As perguntas podem ser apresentadas pela ferramenta de perguntas do assistente ou como mensagens normais, sempre uma de cada vez. Os ficheiros `agents/openai.yaml` fornecem os nomes e prompts de apresentação no Codex; as instruções comuns estão em `SKILL.md`.

A instalação e o uso por comandos seguem os formatos documentados pelos dois assistentes. A execução de uma sessão completa no Claude Code ainda não foi verificada neste computador.

## Conteúdo do repositório

- `skills/promo-motion-video/`: modelo do vídeo e ferramentas de pesquisa, animação, renderização e mistura.
- `skills/promo-voiceover/`: guião, escolha de voz, pronúncia, geração e verificação da narração.
- `skills/talking-head-motion/`: preparação da gravação, receitas de animação e projeto Remotion.
- `skills/PROMPTS-PARA-USAR-AS-SKILLS.md`: comandos e exemplos de utilização.
- `scripts/install-claude-code.mjs`: instalação das três skills no Claude Code.

O vídeo original usado para estudar o estilo de edição não é necessário nem está incluído; a análise e as receitas visuais estão na skill. Os dados de demonstração dos modelos devem ser substituídos pelos do teu trabalho.
