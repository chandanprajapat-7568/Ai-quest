/**
 * TypeScript port of NLTK's averaged-perceptron POS tagger
 * (`nltk.tag.perceptron.PerceptronTagger`, model "averaged_perceptron_tagger_eng").
 *
 * The TRAINED MODEL (weights, tag dictionary, class list) is NLTK's own data,
 * exported to JSON by scripts/export_nltk_data.py. Only the small runtime
 * algorithm (feature extraction + dot product + arg-max) is re-implemented here.
 * Tags are Penn Treebank tags (NN, VBZ, JJ, ...).
 */

export interface PerceptronModel {
  weights: Record<string, Record<string, number>>;
  tagdict: Record<string, string>;
  classes: string[];
}

const START = ["-START-", "-START2-"];
const END = ["-END-", "-END2-"];

/** Same normalisation NLTK applies to context words. */
function normalize(word: string): string {
  if (word.includes("-") && word[0] !== "-") return "!HYPHEN";
  if (/^\d+$/.test(word) && word.length === 4) return "!YEAR";
  if (word.length > 0 && /^\d/.test(word[0])) return "!DIGITS";
  return word.toLowerCase();
}

function getFeatures(
  i: number,
  word: string,
  context: string[],
  prev: string,
  prev2: string,
): Map<string, number> {
  const features = new Map<string, number>();
  const add = (name: string, ...args: string[]) => {
    const key = [name, ...args].join(" ");
    features.set(key, (features.get(key) ?? 0) + 1);
  };
  const idx = i + START.length;
  add("bias");
  add("i suffix", word.slice(-3));
  add("i pref1", word.length > 0 ? word[0] : "");
  add("i-1 tag", prev);
  add("i-2 tag", prev2);
  add("i tag+i-2 tag", prev, prev2);
  add("i word", context[idx]);
  add("i-1 tag+i word", prev, context[idx]);
  add("i-1 word", context[idx - 1]);
  add("i-1 suffix", context[idx - 1].slice(-3));
  add("i-2 word", context[idx - 2]);
  add("i+1 word", context[idx + 1]);
  add("i+1 suffix", context[idx + 1].slice(-3));
  add("i+2 word", context[idx + 2]);
  return features;
}

function predict(model: PerceptronModel, features: Map<string, number>): string {
  const scores = new Map<string, number>();
  for (const [feature, value] of features) {
    const weights = model.weights[feature];
    if (!weights || value === 0) continue;
    for (const label of Object.keys(weights)) {
      scores.set(label, (scores.get(label) ?? 0) + value * weights[label]);
    }
  }
  // NLTK: max(classes, key=(score, label)) -> highest score, ties broken alphabetically (larger label wins)
  let best = model.classes[0];
  let bestScore = scores.get(best) ?? 0;
  for (const label of model.classes) {
    const score = scores.get(label) ?? 0;
    if (score > bestScore || (score === bestScore && label > best)) {
      best = label;
      bestScore = score;
    }
  }
  return best;
}

/** Tag a token list, like `nltk.pos_tag(tokens)`. Returns [token, tag] pairs. */
export function perceptronTag(model: PerceptronModel, tokens: string[]): Array<[string, string]> {
  let prev = START[0];
  let prev2 = START[1];
  const output: Array<[string, string]> = [];
  const context = [...START, ...tokens.map(normalize), ...END];
  tokens.forEach((word, i) => {
    let tag: string | undefined = Object.prototype.hasOwnProperty.call(model.tagdict, word)
      ? model.tagdict[word]
      : undefined;
    if (!tag) tag = predict(model, getFeatures(i, word, context, prev, prev2));
    output.push([word, tag]);
    prev2 = prev;
    prev = tag;
  });
  return output;
}
