"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { NlpAnalysis } from "@/lib/nlp/types";
import { errorMessage, postJson } from "@/lib/client/api";

const MAX_CHARS = 5000;

const OPERATIONS = [
  { id: "remove_stopwords", label: "Remove stop words", hint: "Drops very common words (the, are, and…) using NLTK's English list." },
  { id: "stemming", label: "Stemming", hint: "Porter stemmer: chops word endings by rules. Stems are not always real words." },
  { id: "pos_tag", label: "POS tagging", hint: "Labels each token as noun, verb, adjective… using NLTK's trained tagger." },
] as const;

const SAMPLES = [
  "The cats are running quickly.",
  "She didn't like the loud music, but the students were studying artificial intelligence and enjoying the beautiful garden.",
];

function toPlainText(text: string, r: NlpAnalysis): string {
  const lines = ["AI Quest NLP analysis (English)", `Text: ${text}`, `Tokens: ${r.tokens.join(" | ")}`];
  if (r.filtered_tokens) lines.push(`Tokens without stop words: ${r.filtered_tokens.join(" | ")}`);
  if (r.removed_stopwords) lines.push(`Removed stop words: ${r.removed_stopwords.join(" | ") || "(none)"}`);
  if (r.stems) lines.push(`Stems: ${r.stems.map((s) => `${s.token} -> ${s.stem}`).join(", ")}`);
  if (r.pos_tags) lines.push(`POS tags: ${r.pos_tags.map((p) => `${p.token}/${p.tag} (${p.description})`).join(", ")}`);
  lines.push(`Data: NLTK ${r.engine.nltk_data_version}`);
  return lines.join("\n");
}

export default function NlpAnalyzer() {
  const [text, setText] = useState(SAMPLES[0]);
  const [ops, setOps] = useState<Record<string, boolean>>({ remove_stopwords: true, stemming: true, pos_tag: true });
  const [result, setResult] = useState<NlpAnalysis | null>(null);
  const [analyzedText, setAnalyzedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const copyTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const selected = OPERATIONS.filter((o) => ops[o.id]).map((o) => o.id);
  const tooLong = text.length > MAX_CHARS;
  const empty = text.trim().length === 0;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (empty) return setError("Please enter some English text to analyze.");
    if (tooLong) return setError(`Text is too long: ${text.length} characters (maximum ${MAX_CHARS}).`);
    if (selected.length === 0) return setError("Choose at least one operation.");
    setError(null);
    setLoading(true);
    try {
      const res = await postJson<NlpAnalysis>("/api/nlp/analyze", { text, operations: selected });
      setResult(res);
      setAnalyzedText(text);
    } catch (err) {
      setResult(null);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    const output = toPlainText(analyzedText, result);
    let ok = false;
    try {
      await navigator.clipboard.writeText(output);
      ok = true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = output;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    setCopied(ok ? "ok" : "fail");
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(null), 2500);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <section aria-labelledby="nlp-form-title">
        <form onSubmit={onSubmit} className="card space-y-4" noValidate>
          <div className="flex items-center justify-between gap-3">
            <h2 id="nlp-form-title" className="text-lg font-bold text-white">
              Your text
            </h2>
            <span className="badge badge-violet">English only</span>
          </div>

          <div>
            <label htmlFor="nlp-text" className="field-label">
              Text to analyze
            </label>
            <textarea
              id="nlp-text"
              rows={7}
              className="input resize-y leading-6"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type or paste an English sentence…"
              aria-describedby="nlp-count"
            />
            <div id="nlp-count" className={`mt-1 text-right text-xs tabular-nums ${tooLong ? "font-semibold text-rose-300" : "text-slate-400"}`}>
              {text.length} / {MAX_CHARS} characters
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s, i) => (
              <button key={i} type="button" className="btn btn-secondary btn-sm" onClick={() => setText(s)}>
                {i === 0 ? "Short sample" : "Longer sample"}
              </button>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setText(""); setResult(null); setError(null); }}>
              Clear
            </button>
          </div>

          <fieldset>
            <legend className="field-label">Operations</legend>
            <div className="space-y-2">
              {OPERATIONS.map((o) => (
                <label key={o.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.07]">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-cyan-300"
                    checked={ops[o.id]}
                    onChange={(e) => setOps((prev) => ({ ...prev, [o.id]: e.target.checked }))}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-white">{o.label}</span>
                    <span className="block text-xs leading-5 text-slate-400">{o.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <div role="alert" className="alert-error">
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={loading || empty || tooLong || selected.length === 0}>
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </form>
      </section>

      <section aria-labelledby="nlp-result-title" aria-live="polite" className="min-w-0 space-y-6">
        {!result ? (
          <div className="card grid min-h-64 place-items-center text-center">
            <div>
              <h2 id="nlp-result-title" className="text-lg font-bold text-white">
                Results appear here
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">
                Pick the operations you want and press <strong className="text-white">Analyze</strong>. You will see the tokens and only
                the outputs you asked for.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="nlp-result-title" className="text-lg font-bold text-white">
                  Analysis
                </h2>
                <p className="text-sm text-slate-300">
                  {result.tokens.length} tokens · NLTK {result.engine.nltk_data_version} data
                </p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copy()}>
                {copied === "ok" ? "Copied ✓" : copied === "fail" ? "Copy failed" : "Copy output"}
              </button>
            </div>

            <div className="card">
              <h3 className="text-base font-bold text-white">1. Tokens</h3>
              <p className="mt-1 text-sm text-slate-300">
                The text split into words and punctuation the way <code className="code-inline">nltk.word_tokenize</code> does it
                (for example <code className="code-inline">didn&apos;t</code> becomes <code className="code-inline">did</code> +{" "}
                <code className="code-inline">n&apos;t</code>).
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {result.tokens.map((t, i) => (
                  <li key={i} className="chip">{t}</li>
                ))}
              </ul>
            </div>

            {result.filtered_tokens && result.removed_stopwords && (
              <div className="card">
                <h3 className="text-base font-bold text-white">2. Stop-word removal</h3>
                <p className="mt-1 text-sm text-slate-300">
                  Kept {result.filtered_tokens.length} tokens; removed {result.removed_stopwords.length} stop words (punctuation is dropped too).
                </p>
                <h4 className="field-label mt-3">Filtered tokens</h4>
                {result.filtered_tokens.length === 0 ? (
                  <p className="text-sm text-slate-400">Every token was a stop word or punctuation.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {result.filtered_tokens.map((t, i) => (
                      <li key={i} className="chip border-cyan-300/40 bg-cyan-300/10">{t}</li>
                    ))}
                  </ul>
                )}
                <h4 className="field-label mt-4">Removed stop words</h4>
                {result.removed_stopwords.length === 0 ? (
                  <p className="text-sm text-slate-400">None of the tokens were stop words.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {result.removed_stopwords.map((t, i) => (
                      <li key={i} className="chip text-slate-400 line-through decoration-rose-300/70">{t}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {result.stems && (
              <div className="card">
                <h3 className="text-base font-bold text-white">3. Stemming (Porter)</h3>
                <p className="mt-1 text-sm text-slate-300">
                  Rule-based suffix stripping{result.filtered_tokens ? ", applied to the filtered tokens" : ", applied to the word tokens"}. This is{" "}
                  <strong className="text-white">not</strong> lemmatization: a stem such as <code className="code-inline">quickli</code> need not be a real word.
                </p>
                {result.stems.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-400">No word tokens to stem.</p>
                ) : (
                  <div className="table-wrap">
                    <table className="data min-w-[20rem]">
                      <thead>
                        <tr>
                          <th scope="col">Token</th>
                          <th scope="col">Stem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.stems.map((s, i) => (
                          <tr key={i}>
                            <td className="font-mono text-slate-100">{s.token}</td>
                            <td className={`font-mono ${s.token.toLowerCase() === s.stem ? "text-slate-400" : "font-semibold text-cyan-200"}`}>{s.stem}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {result.pos_tags && (
              <div className="card">
                <h3 className="text-base font-bold text-white">4. POS tags (Penn Treebank)</h3>
                <p className="mt-1 text-sm text-slate-300">
                  Tags come from NLTK&apos;s averaged-perceptron tagger, run on the full token list because a tagger needs the surrounding
                  words for context.
                </p>
                <div className="table-wrap">
                  <table className="data min-w-[24rem]">
                    <thead>
                      <tr>
                        <th scope="col">Token</th>
                        <th scope="col">Tag</th>
                        <th scope="col">Meaning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.pos_tags.map((p, i) => (
                        <tr key={i}>
                          <td className="font-mono text-slate-100">{p.token}</td>
                          <td><span className="badge badge-violet font-mono">{p.tag}</span></td>
                          <td>{p.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
