/**
 * NLP service: stop-word removal, Porter stemming and POS tagging for English text.
 *
 * Data & algorithms (all traceable to NLTK):
 *  • Tokenization : port of nltk.word_tokenize            (word-tokenizer.ts)
 *  • Stop words   : NLTK's `stopwords/english` corpus      (data/nltk/stopwords.english.json)
 *  • Stemming     : port of nltk.stem.PorterStemmer         (porter-stemmer.ts)
 *  • POS tagging  : NLTK's averaged_perceptron_tagger_eng   (data/nltk/*.json + perceptron-tagger.ts)
 *
 * If a data file is missing this module throws NlpResourceError naming the exact
 * resource and the command that fixes it. It never fabricates output.
 *
 * Pipeline order when several operations are chosen:
 *   text -> tokens ->  (a) POS tags on ALL tokens (a tagger needs full sentence context)
 *                      (b) stop-word removal     -> filtered_tokens
 *                      (c) stemming of word tokens (filtered ones if (b) was chosen)
 */

import fs from "node:fs";
import path from "node:path";
import { ApiError } from "@/lib/errors";
import type { NlpOperation } from "@/lib/validation";
import { porterStem } from "./porter-stemmer";
import { perceptronTag, type PerceptronModel } from "./perceptron-tagger";
import { describeTag } from "./pos-descriptions";
import { wordTokenize } from "./word-tokenizer";
import type { NlpAnalysis } from "./types";

export class NlpResourceError extends ApiError {
  constructor(resource: string, file: string, detail?: string) {
    super(
      503,
      "NLP_RESOURCE_MISSING",
      `NLTK resource "${resource}" could not be loaded from data/nltk/${file}${detail ? ` (${detail})` : ""}. ` +
        `Fix: install Python + NLTK ("pip install nltk") and run "python scripts/export_nltk_data.py" from the project folder, then restart the app.`,
    );
    this.name = "NlpResourceError";
  }
}

/** Folder holding the exported NLTK data. AIQUEST_NLTK_DATA_DIR is a testing hook to simulate missing data. */
const dataDir = (): string =>
  process.env.AIQUEST_NLTK_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "nltk");
const TAGGER_PREFIX = "averaged_perceptron_tagger_eng";

function readJson<T>(resource: string, file: string): T {
  // Read at runtime from <project>/data/nltk (not bundled), so tell the bundler not to trace it.
  const full = path.join(/*turbopackIgnore: true*/ dataDir(), file);
  let raw: string;
  try {
    raw = fs.readFileSync(/*turbopackIgnore: true*/ full, "utf8");
  } catch {
    throw new NlpResourceError(resource, file, "file not found");
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new NlpResourceError(resource, file, "file is not valid JSON");
  }
}

let stopwordCache: Set<string> | null = null;
let taggerCache: PerceptronModel | null = null;
let versionCache: string | null = null;

export function loadStopwords(): Set<string> {
  if (!stopwordCache) {
    stopwordCache = new Set(readJson<string[]>("stopwords", "stopwords.english.json"));
  }
  return stopwordCache;
}

export function loadTagger(): PerceptronModel {
  if (!taggerCache) {
    const weights = readJson<PerceptronModel["weights"]>(
      TAGGER_PREFIX,
      `${TAGGER_PREFIX}.weights.json`,
    );
    const tagdict = readJson<PerceptronModel["tagdict"]>(
      TAGGER_PREFIX,
      `${TAGGER_PREFIX}.tagdict.json`,
    );
    const classes = readJson<string[]>(TAGGER_PREFIX, `${TAGGER_PREFIX}.classes.json`);
    taggerCache = { weights, tagdict, classes };
  }
  return taggerCache;
}

function nltkVersion(): string {
  if (!versionCache) {
    try {
      versionCache = readJson<{ nltk_version: string }>("manifest", "MANIFEST.json").nltk_version;
    } catch {
      versionCache = "unknown";
    }
  }
  return versionCache;
}

/** A token counts as a "word" if it contains at least one letter or digit (so "." and "``" do not). */
const isWordToken = (token: string): boolean => /[\p{L}\p{N}]/u.test(token);

export function analyzeText(text: string, operations: NlpOperation[]): NlpAnalysis {
  const wanted = new Set(operations);

  // Load every needed resource FIRST so a missing file fails the whole request cleanly.
  const stopwords = wanted.has("remove_stopwords") ? loadStopwords() : null;
  const tagger = wanted.has("pos_tag") ? loadTagger() : null;

  const tokens = wordTokenize(text);
  const result: NlpAnalysis = {
    language: "english",
    operations,
    tokens,
    engine: {
      nltk_data_version: nltkVersion(),
      notes:
        "Tokenizer, stemmer and POS tagger are TypeScript ports of the NLTK algorithms; stop words and the tagger model are NLTK's own data.",
    },
  };

  // (a) POS tags on the complete token list, exactly like nltk.pos_tag(word_tokenize(text)).
  if (tagger) {
    result.pos_tags = perceptronTag(tagger, tokens).map(([token, tag]) => ({
      token,
      tag,
      description: describeTag(tag),
    }));
  }

  // (b) Stop-word removal: case-insensitive match against NLTK's English list; punctuation-only tokens are dropped too.
  let working = tokens;
  if (stopwords) {
    const removed: string[] = [];
    const kept: string[] = [];
    for (const token of tokens) {
      if (!isWordToken(token)) continue;
      if (stopwords.has(token.toLowerCase())) removed.push(token);
      else kept.push(token);
    }
    result.filtered_tokens = kept;
    result.removed_stopwords = removed;
    working = kept;
  }

  // (c) Stemming (rule-based suffix stripping, NOT lemmatization).
  if (wanted.has("stemming")) {
    result.stems = working
      .filter(isWordToken)
      .map((token) => ({ token, stem: porterStem(token) }));
  }

  return result;
}
