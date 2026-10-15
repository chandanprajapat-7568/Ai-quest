/**
 * TypeScript port of NLTK's `nltk.stem.PorterStemmer` (default mode: NLTK_EXTENSIONS).
 *
 * This is a STEMMER, not a lemmatizer: it chops suffixes with rules, so results such
 * as "quickly" -> "quickli" or "studies" -> "studi" are not dictionary words.
 *
 * The port follows the NLTK source rule by rule and is checked against real NLTK
 * output in tests/verify.ts (tests/fixtures/nltk_reference.json).
 */

type Condition = ((stem: string) => boolean) | null;
type Rule = [suffix: string, replacement: string, condition: Condition];

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

// NLTK_EXTENSIONS: words that get a fixed stem instead of running the rules.
const IRREGULAR_FORMS: Record<string, string[]> = {
  sky: ["sky", "skies"],
  die: ["dying"],
  lie: ["lying"],
  tie: ["tying"],
  news: ["news"],
  inning: ["innings", "inning"],
  outing: ["outings", "outing"],
  canning: ["cannings", "canning"],
  howe: ["howe"],
  proceed: ["proceed"],
  exceed: ["exceed"],
  succeed: ["succeed"],
};

const POOL = new Map<string, string>();
for (const [stem, forms] of Object.entries(IRREGULAR_FORMS)) {
  for (const form of forms) POOL.set(form, stem);
}

function isConsonant(word: string, index: number): boolean {
  let i = index;
  if (VOWELS.has(word[i])) return false;
  if (word[i] === "y") {
    let negate = false;
    while (i > 0 && word[i] === "y") {
      negate = !negate;
      i -= 1;
    }
    return !VOWELS.has(word[i]) !== negate;
  }
  return true;
}

function consonantFlags(word: string): boolean[] {
  const flags: boolean[] = [];
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (VOWELS.has(ch)) flags.push(false);
    else if (ch === "y") flags.push(i === 0 ? true : !flags[i - 1]);
    else flags.push(true);
  }
  return flags;
}

/** Porter "measure" m: the number of vowel->consonant transitions ("VC" pairs). */
function measure(stem: string): number {
  const cv = consonantFlags(stem)
    .map((isCons) => (isCons ? "c" : "v"))
    .join("");
  let count = 0;
  for (let i = cv.indexOf("vc"); i !== -1; i = cv.indexOf("vc", i + 2)) count++;
  return count;
}

const hasPositiveMeasure = (stem: string) => measure(stem) > 0;
const containsVowel = (stem: string) => consonantFlags(stem).some((isCons) => !isCons);

const endsDoubleConsonant = (word: string) =>
  word.length >= 2 && word[word.length - 1] === word[word.length - 2] && isConsonant(word, word.length - 1);

function endsCvc(word: string): boolean {
  const n = word.length;
  return (
    (n >= 3 &&
      isConsonant(word, n - 3) &&
      !isConsonant(word, n - 2) &&
      isConsonant(word, n - 1) &&
      !["w", "x", "y"].includes(word[n - 1])) ||
    // NLTK extension: a two-letter word "vowel + consonant" (e.g. "at") counts as CVC
    (n === 2 && !isConsonant(word, 0) && isConsonant(word, 1))
  );
}

const replaceSuffix = (word: string, suffix: string, replacement: string) =>
  suffix === "" ? word + replacement : word.slice(0, word.length - suffix.length) + replacement;

/** First matching rule wins; if its condition fails the word is returned unchanged. */
function applyRuleList(word: string, rules: Rule[]): string {
  for (const [suffix, replacement, condition] of rules) {
    if (suffix === "*d") {
      if (endsDoubleConsonant(word)) {
        const stem = word.slice(0, -2);
        return condition === null || condition(stem) ? stem + replacement : word;
      }
      continue;
    }
    if (word.endsWith(suffix)) {
      const stem = replaceSuffix(word, suffix, "");
      return condition === null || condition(stem) ? stem + replacement : word;
    }
  }
  return word;
}

function step1a(word: string): string {
  if (word.endsWith("ies") && word.length === 4) return replaceSuffix(word, "ies", "ie");
  return applyRuleList(word, [
    ["sses", "ss", null],
    ["ies", "i", null],
    ["ss", "ss", null],
    ["s", "", null],
  ]);
}

function step1b(word: string): string {
  if (word.endsWith("ied")) {
    return word.length === 4 ? replaceSuffix(word, "ied", "ie") : replaceSuffix(word, "ied", "i");
  }
  if (word.endsWith("eed")) {
    const stem = replaceSuffix(word, "eed", "");
    return measure(stem) > 0 ? stem + "ee" : word;
  }
  let intermediate = "";
  let succeeded = false;
  for (const suffix of ["ed", "ing"]) {
    if (word.endsWith(suffix)) {
      intermediate = replaceSuffix(word, suffix, "");
      if (containsVowel(intermediate)) {
        succeeded = true;
        break;
      }
    }
  }
  if (!succeeded) return word;
  const last = intermediate[intermediate.length - 1];
  return applyRuleList(intermediate, [
    ["at", "ate", null],
    ["bl", "ble", null],
    ["iz", "ize", null],
    ["*d", last, () => !["l", "s", "z"].includes(last)],
    ["", "e", (stem) => measure(stem) === 1 && endsCvc(stem)],
  ]);
}

function step1c(word: string): string {
  // NLTK condition: replace final y by i only if the stem is longer than 1 letter and ends in a consonant
  return applyRuleList(word, [
    ["y", "i", (stem) => stem.length > 1 && isConsonant(stem, stem.length - 1)],
  ]);
}

function step2(word: string): string {
  if (word.endsWith("alli") && hasPositiveMeasure(replaceSuffix(word, "alli", ""))) {
    return step2(replaceSuffix(word, "alli", "al"));
  }
  const m0 = hasPositiveMeasure;
  const rules: Rule[] = [
    ["ational", "ate", m0],
    ["tional", "tion", m0],
    ["enci", "ence", m0],
    ["anci", "ance", m0],
    ["izer", "ize", m0],
    ["bli", "ble", m0],
    ["alli", "al", m0],
    ["entli", "ent", m0],
    ["eli", "e", m0],
    ["ousli", "ous", m0],
    ["ization", "ize", m0],
    ["ation", "ate", m0],
    ["ator", "ate", m0],
    ["alism", "al", m0],
    ["iveness", "ive", m0],
    ["fulness", "ful", m0],
    ["ousness", "ous", m0],
    ["aliti", "al", m0],
    ["iviti", "ive", m0],
    ["biliti", "ble", m0],
    ["fulli", "ful", m0],
    ["logi", "log", () => hasPositiveMeasure(word.slice(0, -3))],
  ];
  return applyRuleList(word, rules);
}

function step3(word: string): string {
  const m0 = hasPositiveMeasure;
  return applyRuleList(word, [
    ["icate", "ic", m0],
    ["ative", "", m0],
    ["alize", "al", m0],
    ["iciti", "ic", m0],
    ["ical", "ic", m0],
    ["ful", "", m0],
    ["ness", "", m0],
  ]);
}

function step4(word: string): string {
  const m1 = (stem: string) => measure(stem) > 1;
  return applyRuleList(word, [
    ["al", "", m1],
    ["ance", "", m1],
    ["ence", "", m1],
    ["er", "", m1],
    ["ic", "", m1],
    ["able", "", m1],
    ["ible", "", m1],
    ["ant", "", m1],
    ["ement", "", m1],
    ["ment", "", m1],
    ["ent", "", m1],
    ["ion", "", (stem) => measure(stem) > 1 && ["s", "t"].includes(stem[stem.length - 1])],
    ["ou", "", m1],
    ["ism", "", m1],
    ["ate", "", m1],
    ["iti", "", m1],
    ["ous", "", m1],
    ["ive", "", m1],
    ["ize", "", m1],
  ]);
}

function step5a(word: string): string {
  if (word.endsWith("e")) {
    const stem = replaceSuffix(word, "e", "");
    if (measure(stem) > 1) return stem;
    if (measure(stem) === 1 && !endsCvc(stem)) return stem;
  }
  return word;
}

function step5b(word: string): string {
  return applyRuleList(word, [["ll", "l", () => measure(word.slice(0, -1)) > 1]]);
}

/** Stem one word (lower-cased first, like NLTK's `PorterStemmer().stem(word)`). */
export function porterStem(word: string): string {
  let stem = word.toLowerCase();
  const irregular = POOL.get(stem);
  if (irregular !== undefined) return irregular;
  if (word.length <= 2) return stem;
  stem = step1a(stem);
  stem = step1b(stem);
  stem = step1c(stem);
  stem = step2(stem);
  stem = step3(stem);
  stem = step4(stem);
  stem = step5a(stem);
  stem = step5b(stem);
  return stem;
}
