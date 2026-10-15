/**
 * Word tokenizer modelled on NLTK's `word_tokenize` (English).
 *
 * NLTK's `word_tokenize` does two things:
 *   1. split the text into sentences with the trained Punkt model;
 *   2. tokenize each sentence with `NLTKWordTokenizer` (a list of regex rules).
 *
 * Step 2 is ported rule by rule from the NLTK source below.
 * Step 1 is a SIMPLIFIED rule-based splitter (Punkt's trained model is not
 * available in JavaScript). It handles ordinary sentences, common abbreviations
 * (Dr., Mr., U.S., p.m. ...) and initials, but unusual abbreviations may be split
 * differently from real NLTK. This is documented as a limitation.
 */

const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "mt", "vs", "etc", "inc", "ltd", "co",
  "corp", "gen", "col", "lt", "sgt", "capt", "gov", "sen", "rep", "rev", "hon", "dept", "univ",
  "approx", "fig", "no", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct",
  "nov", "dec", "e.g", "i.e", "u.s", "u.k", "a.m", "p.m", "ph.d",
]);

/** Simplified stand-in for Punkt sentence splitting. */
export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  const boundary = /([.!?]+)(["'”’)\]]*)(\s+)/g;
  let start = 0;
  for (const m of text.matchAll(boundary)) {
    const idx = m.index as number;
    const next = text[idx + m[0].length];
    if (next === undefined) continue;
    let split = true;
    if (/[a-z]/.test(next)) split = false; // sentence continues in lower case
    if (split && m[1] === ".") {
      const before = text.slice(start, idx).match(/(\S+)$/)?.[1] ?? "";
      const word = before.replace(/^[("'“‘[]+/, "").toLowerCase();
      if (ABBREVIATIONS.has(word)) split = false;
      if (/^[a-z]$/.test(word)) split = false; // initials such as "J."
    }
    if (split) {
      sentences.push(text.slice(start, idx + m[1].length + m[2].length));
      start = idx + m[0].length;
    }
  }
  sentences.push(text.slice(start));
  return sentences.filter((s) => s.trim().length > 0);
}

type Sub = [RegExp, string | ((...args: string[]) => string)];

// Rules below are copied from nltk.tokenize.destructive.NLTKWordTokenizer.
// (Python's inline `(?i)` became the JS `i` flag; `(?#X)` comments were dropped.)

const STARTING_QUOTES: Sub[] = [
  [/([«“‘„]|[`]+)/g, " $1 "],
  [/^"/, "``"],
  [/(``)/g, " $1 "],
  [/([ (\[{<])("|'{2})/g, (_m, a) => `${a} \`\` `],
  [/(?<!\w)(')(?!(?:re|ve|ll|m|t|s|d|n)\b)(?=\w)/gi, "$1 "],
];

const PUNCTUATION: Sub[] = [
  [/([^.])(\.)([\])}>"'»”’ ]*)\s*$/g, "$1 $2 $3 "],
  [/([:,])([^\d])/g, " $1 $2"],
  [/([:,])$/g, " $1 "],
  [/\.{2,}/g, " $& "],
  [/[;@#$%&]/g, " $& "],
  [/[\u2012-\u2015]/g, " $& "],
  [/([^.])(\.)([\])}>"']*)\s*$/g, "$1 $2$3 "],
  [/[?!]/g, " $& "],
  [/([^'])' /g, "$1 ' "],
  [/[*]/g, " $& "],
];

const PARENS_BRACKETS: Sub = [/[\][(){}<>]/g, " $& "];
const DOUBLE_DASHES: Sub = [/--/g, " -- "];

const ENDING_QUOTES: Sub[] = [
  [/([»”’])/g, " $1 "],
  [/''/g, " '' "],
  [/"/g, " '' "],
  [/\s+/g, " "],
  [/([^' ])('[sS]|'[mM]|'[dD]|') /g, "$1 $2 "],
  [/([^' ])('ll|'LL|'re|'RE|'ve|'VE|n't|N'T) /g, "$1 $2 "],
];

const CONTRACTIONS2: RegExp[] = [
  /\b(can)(not)\b/gi,
  /\b(d)('ye)\b/gi,
  /\b(gim)(me)\b/gi,
  /\b(gon)(na)\b/gi,
  /\b(got)(ta)\b/gi,
  /\b(lem)(me)\b/gi,
  /\b(more)('n)\b/gi,
  /\b(wan)(na)(?=\s)/gi,
];
const CONTRACTIONS3: RegExp[] = [/ ('t)(is)\b/gi, / ('t)(was)\b/gi];

const applySub = (text: string, [pattern, replacement]: Sub): string =>
  text.replace(pattern, replacement as string);

/** Tokenize ONE sentence (port of NLTKWordTokenizer.tokenize). */
export function tokenizeSentence(sentence: string): string[] {
  let text = sentence;
  for (const sub of STARTING_QUOTES) text = applySub(text, sub);
  for (const sub of PUNCTUATION) text = applySub(text, sub);
  text = applySub(text, PARENS_BRACKETS);
  text = applySub(text, DOUBLE_DASHES);
  text = ` ${text} `;
  for (const sub of ENDING_QUOTES) text = applySub(text, sub);
  for (const re of CONTRACTIONS2) text = text.replace(re, " $1 $2 ");
  for (const re of CONTRACTIONS3) text = text.replace(re, " $1 $2 ");
  return text.split(/\s+/).filter((t) => t.length > 0);
}

/** English word tokenization: sentence split, then per-sentence NLTK rules. */
export function wordTokenize(text: string): string[] {
  return splitSentences(text).flatMap(tokenizeSentence);
}
