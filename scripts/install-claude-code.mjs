// Copies the complete skills, including templates and hidden files, without overwriting local edits.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../skills/', import.meta.url));
const skills = ['promo-motion-video', 'promo-voiceover', 'talking-head-motion'];

function statIfPresent(location) {
  try { return fs.lstatSync(location); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// Resolve existing parents too, so a destination symlink cannot point back into the sources.
function realLocation(location) {
  if (statIfPresent(location)) return fs.realpathSync(location);
  const parent = path.dirname(location);
  if (parent === location) throw new Error(`Localização indisponível: ${location}`);
  return path.join(realLocation(parent), path.basename(location));
}

function snapshot(root) {
  const files = new Map();
  function visit(relative) {
    const location = path.join(root, relative);
    const stat = fs.lstatSync(location);
    if (stat.isDirectory()) {
      files.set(relative, null);
      for (const name of fs.readdirSync(location)) visit(path.join(relative, name));
    } else if (stat.isFile()) {
      files.set(relative, fs.readFileSync(location));
    } else {
      throw new Error(`A pasta contém uma ligação ou um ficheiro especial; compara manualmente: ${location}`);
    }
  }
  visit('');
  return files;
}

function identical(left, right) {
  return left.size === right.size && [...left].every(([name, contents]) =>
    right.has(name) && (contents === null ? right.get(name) === null :
      Buffer.isBuffer(right.get(name)) && contents.equals(right.get(name))));
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log('Uso: node scripts/install-claude-code.mjs [--dest <pasta-de-skills>]');
    console.log('Destino por omissão: ~/.claude/skills. Versões diferentes nunca são substituídas.');
    return;
  }
  if (args.length !== 0 && (args.length !== 2 || args[0] !== '--dest' || !args[1] || args[1].startsWith('--'))) {
    throw new Error('Argumentos inválidos. Usa --help para consultar a instalação.');
  }

  const destination = realLocation(path.resolve(args[1] ?? path.join(os.homedir(), '.claude', 'skills')));
  const relative = path.relative(fs.realpathSync(sourceRoot), destination);
  if (relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))) {
    throw new Error('Escolhe uma pasta de destino fora da pasta skills deste repositório.');
  }
  const destinationStat = statIfPresent(destination);
  if (destinationStat && !destinationStat.isDirectory()) {
    throw new Error(`O destino não é uma pasta: ${destination}`);
  }

  // Check all three before creating anything, including missing sibling skills.
  const plan = skills.map(name => {
    const source = path.join(sourceRoot, name);
    const target = path.join(destination, name);
    const sourceFiles = snapshot(source);
    if (!Buffer.isBuffer(sourceFiles.get('SKILL.md'))) {
      throw new Error(`Falta o ficheiro SKILL.md em ${source}`);
    }
    const existing = statIfPresent(target);
    if (existing && (!existing.isDirectory() || !identical(sourceFiles, snapshot(target)))) {
      throw new Error(`Já existe uma versão diferente em ${target}. Pede ao assistente para comparar e integrar as alterações. Nenhuma skill foi copiada.`);
    }
    return { name, source, target, exists: Boolean(existing) };
  });

  fs.mkdirSync(destination, { recursive: true });
  for (const item of plan) {
    if (item.exists) {
      console.log(`Já instalada e idêntica: ${item.name}`);
    } else {
      fs.cpSync(item.source, item.target, { recursive: true, force: false, errorOnExist: true });
      console.log(`Instalada: ${item.name}`);
    }
  }
  console.log(`\nSkills disponíveis em: ${destination}`);
  console.log('No Claude Code, usa /promo-motion-video, /promo-voiceover ou /talking-head-motion.');
  console.log('Se os comandos não aparecerem, abre uma nova sessão.');
}

try { main(); }
catch (error) {
  console.error(`Erro: ${error.message}`);
  process.exitCode = 1;
}
