// Text utilities for checking takes: normalisation, number spelling (pt/en), word error rate,
// STT token merging and word alignment (script words -> timed STT words).

const PT = {
  u: ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove'],
  t: ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'],
  h: ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'],
};
function ptWords(n) {
  if (n < 20) return PT.u[n];
  if (n < 100) return PT.t[Math.floor(n / 10)] + (n % 10 ? ' e ' + PT.u[n % 10] : '');
  if (n === 100) return 'cem';
  if (n < 1000) return PT.h[Math.floor(n / 100)] + (n % 100 ? ' e ' + ptWords(n % 100) : '');
  if (n < 1e6) { const k = Math.floor(n / 1000), r = n % 1000; return (k === 1 ? 'mil' : ptWords(k) + ' mil') + (r ? ((r < 100 || r % 100 === 0) ? ' e ' : ' ') + ptWords(r) : ''); }
  return String(n);
}
const EN = { u: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'], t: ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] };
function enWords(n) {
  if (n < 20) return EN.u[n];
  if (n < 100) return EN.t[Math.floor(n / 10)] + (n % 10 ? ' ' + EN.u[n % 10] : '');
  if (n < 1000) return EN.u[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + enWords(n % 100) : '');
  if (n < 1e6) return enWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + enWords(n % 1000) : '');
  return String(n);
}
// "18" -> "dezoito" (pt) / "eighteen" (en)
export const spellNumbers = (s, lang = 'pt') => String(s).replace(/\d+/g, d => (/^pt/i.test(lang) ? ptWords : enWords)(+d));

// lower-case, no accents, no tags ([warm], <breath>), no emphasis marks, numbers spelled out, single spaces.
// Word-local, so norm(line) === the concatenation of norm(word) for every word of the line.
export function norm(s, lang = 'pt') {
  return spellNumbers(String(s), lang).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\[[^\]]*\]|<[^>]*>/g, ' ').replace(/\*/g, '').replace(/(\w)[’'](\w)/g, '$1$2')
    .replace(/[-–—/.]/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
// apply alias pairs [from, to] (normalised text) so accepted spellings compare equal
export const applyAliases = (s, aliases = []) => aliases.reduce((acc, [from, to]) => acc.replace(new RegExp(`(^| )${from}(?= |$)`, 'g'), `$1${to}`), s);
// STT writes numbers as digits without grammatical gender ('1 equipa'): compare pt number words gender-free
const PT_GENDER = [[/\buma\b/g, 'um'], [/\bduas\b/g, 'dois'], [/\b(duz|trez|quatroc|quinh|seisc|setec|oitoc|novec)entas\b/g, '$1entos']];
const genderFree = (s, lang) => (/^pt/i.test(lang) ? PT_GENDER.reduce((acc, [re, to]) => acc.replace(re, to), s) : s);
const toks = (s, lang, aliases) => genderFree(applyAliases(norm(s, lang), aliases), lang).split(' ').filter(Boolean);

function levenshtein(r, h) {
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++) for (let j = 1; j <= h.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
  return d;
}
export function wer(ref, hyp, lang = 'pt', aliases = []) {
  const r = toks(ref, lang, aliases), h = toks(hyp, lang, aliases);
  if (!r.length) return h.length ? 1 : 0;
  return levenshtein(r, h)[r.length][h.length] / r.length;
}
// script words that are missing from what was heard (after aliases), for readable reports
export function missing(ref, hyp, lang = 'pt', aliases = []) {
  const h = new Set(toks(hyp, lang, aliases));
  return toks(ref, lang, aliases).filter(w => !h.has(w));
}

// Soniox tokens are sub-word pieces; a piece that starts with a space starts a new word
export function timedWords(tokens) {
  const out = [];
  for (const t of tokens || []) {
    const txt = t.text; if (!txt || /^[\s.,!?;:—–…"“”«»()-]+$/.test(txt)) continue;
    if (!out.length || /^\s/.test(txt)) out.push({ w: txt.trim(), s: t.start_ms / 1000, e: t.end_ms / 1000 });
    else { const last = out[out.length - 1]; last.w += txt; last.e = t.end_ms / 1000; }
  }
  return out;
}

// Align the normalised script words to timed STT words (DP backtrace). Returns one {w, s, e} per
// normalised script word; words the STT missed get times interpolated from their neighbours.
export function alignWords(refText, timed, lang = 'pt', aliases = []) {
  const ref = toks(refText, lang, aliases);
  const hyp = []; // STT words expanded into normalised pieces that share the parent's timing
  timed.forEach(tw => toks(tw.w, lang, aliases).forEach((p, k, all) => hyp.push({ w: p, s: k ? tw.s + (tw.e - tw.s) * k / all.length : tw.s, e: tw.e })));
  const d = levenshtein(ref, hyp.map(x => x.w));
  const out = ref.map(w => ({ w, s: null, e: null }));
  for (let i = ref.length, j = hyp.length; i > 0 || j > 0;) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1].w ? 0 : 1)) { out[i - 1].s = hyp[j - 1].s; out[i - 1].e = hyp[j - 1].e; out[i - 1].exact = ref[i - 1] === hyp[j - 1].w; i--; j--; }
    else if (i > 0 && d[i][j] === d[i - 1][j] + 1) i--;
    else j--;
  }
  for (let i = 0; i < out.length; i++) if (out[i].s == null) {
    const prev = out.slice(0, i).reverse().find(x => x.s != null), next = out.slice(i + 1).find(x => x.s != null);
    out[i].s = prev ? prev.e : next ? next.s : 0; out[i].e = next ? next.s : out[i].s + 0.2;
  }
  return out;
}
// onset of each whitespace-separated display word of `line`, given the aligned words of that line
export function displayOnsets(line, aligned, lang = 'pt') {
  let k = 0; const res = [];
  for (const dw of String(line).replace(/\[[^\]]*\]|<[^>]*>/g, ' ').split(/\s+/).filter(Boolean)) {
    const n = norm(dw, lang).split(' ').filter(Boolean).length;
    res.push(aligned[Math.min(k, aligned.length - 1)]?.s ?? 0); k += n;
  }
  return res;
}

// approximate syllables (vowel groups after normalisation; English 'y' counts as a vowel) for pace checks
export function syllables(s, lang = 'pt') {
  const v = /^en/i.test(lang) ? /[aeiouy]+/g : /[aeiou]+/g;
  return norm(s, lang).split(' ').filter(Boolean).reduce((a, w) => a + Math.max(1, (w.match(v) || []).length), 0);
}
