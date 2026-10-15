"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { JugAlgorithm, JugResult, JugState } from "@/lib/algorithms/water-jug";
import { errorMessage, postJson } from "@/lib/client/api";

const PRESETS: Array<{ label: string; a: string; b: string; goal: string; note: string }> = [
  { label: "Classic 4 L / 3 L → 2 L", a: "4", b: "3", goal: "2", note: "The textbook example." },
  { label: "3 L / 5 L → 4 L", a: "3", b: "5", goal: "4", note: "Needs a longer sequence of pours." },
  { label: "4 L / 6 L → 3 L (impossible)", a: "4", b: "6", goal: "3", note: "3 is not a multiple of gcd(4, 6) = 2." },
];

function validate(a: string, b: string, goal: string): string | null {
  const nums = [a, b, goal].map((v) => (v.trim() === "" ? NaN : Number(v)));
  if (nums.some((n) => !Number.isInteger(n))) return "Please enter whole numbers in all three boxes.";
  const [ca, cb, g] = nums;
  if (ca < 1 || ca > 20 || cb < 1 || cb > 20) return "Jug capacities must be between 1 and 20 litres.";
  if (g < 0 || g > 20) return "The goal must be between 0 and 20 litres.";
  if (g > Math.max(ca, cb))
    return `The goal (${g} L) cannot be larger than the biggest jug (${Math.max(ca, cb)} L), because the target amount must fit inside one jug.`;
  return null;
}

function Jug({ name, amount, capacity, maxCapacity }: { name: string; amount: number; capacity: number; maxCapacity: number }) {
  const height = 60 + (capacity / maxCapacity) * 150; // px, so the bigger jug looks bigger
  return (
    <figure className="flex flex-col items-center gap-2" aria-label={`Jug ${name}: ${amount} of ${capacity} litres`}>
      <div className="jug-body" style={{ height }}>
        <div className="jug-water" style={{ height: `${(amount / capacity) * 100}%` }} />
        <div className="jug-ticks" aria-hidden="true">
          {Array.from({ length: capacity }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      </div>
      <figcaption className="text-center">
        <span className="block text-sm font-semibold text-white">Jug {name}</span>
        <span className="font-mono text-lg font-bold text-cyan-200 tabular-nums">{amount}</span>
        <span className="text-sm text-slate-300"> / {capacity} L</span>
      </figcaption>
    </figure>
  );
}

export default function WaterJugSolver() {
  const [a, setA] = useState("4");
  const [b, setB] = useState("3");
  const [goal, setGoal] = useState("2");
  const [algorithm, setAlgorithm] = useState<JugAlgorithm>("bfs");
  const [result, setResult] = useState<JugResult | null>(null);
  const [solved, setSolved] = useState<{ a: number; b: number; goal: number } | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = result?.steps ?? [];
  const running = playing && result !== null && stepIndex < steps.length - 1;

  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => setStepIndex((i) => i + 1), 900);
    return () => window.clearTimeout(id);
  }, [running, stepIndex]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validate(a, b, goal);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setLoading(true);
    setPlaying(false);
    try {
      const body = { capacity_a: Number(a), capacity_b: Number(b), goal: Number(goal), algorithm };
      const res = await postJson<JugResult>("/api/water-jug/solve", body);
      setResult(res);
      setSolved({ a: body.capacity_a, b: body.capacity_b, goal: body.goal });
      setStepIndex(0);
    } catch (err) {
      setResult(null);
      setSolved(null);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const current: JugState = steps[stepIndex]?.state ?? [0, 0];
  const capA = solved?.a ?? (Number(a) || 1);
  const capB = solved?.b ?? (Number(b) || 1);
  const maxCap = Math.max(capA, capB, 1);
  const atGoal = (s: JugState) => solved !== null && (s[0] === solved.goal || s[1] === solved.goal);

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      {/* ─────────── Inputs ─────────── */}
      <section aria-labelledby="jug-form-title" className="space-y-6">
        <form onSubmit={onSubmit} className="card space-y-4" noValidate>
          <h2 id="jug-form-title" className="text-lg font-bold text-white">
            Problem setup
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="jug-a" className="field-label">Jug A (L)</label>
              <input id="jug-a" className="input" inputMode="numeric" value={a} onChange={(e) => setA(e.target.value)} />
            </div>
            <div>
              <label htmlFor="jug-b" className="field-label">Jug B (L)</label>
              <input id="jug-b" className="input" inputMode="numeric" value={b} onChange={(e) => setB(e.target.value)} />
            </div>
            <div>
              <label htmlFor="jug-goal" className="field-label">Goal (L)</label>
              <input id="jug-goal" className="input" inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value)} />
            </div>
          </div>
          <p className="text-xs leading-5 text-slate-400">
            Capacities 1–20 L. The goal is reached when <em>either</em> jug holds exactly the goal amount.
          </p>

          <fieldset>
            <legend className="field-label">Search algorithm</legend>
            <div className="seg">
              {(
                [
                  ["bfs", "BFS (queue)"],
                  ["dfs", "DFS (stack)"],
                ] as Array<[JugAlgorithm, string]>
              ).map(([value, text]) => (
                <label key={value} className="seg-item">
                  <input
                    type="radio"
                    name="jug-algorithm"
                    value={value}
                    checked={algorithm === value}
                    onChange={() => setAlgorithm(value)}
                    className="sr-only"
                  />
                  {text}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {algorithm === "bfs"
                ? "BFS tries all 1-action states, then all 2-action states, and so on, so it returns the fewest actions."
                : "DFS follows one branch as far as it can before backing up. It finds a solution but often a longer one."}
            </p>
          </fieldset>

          {error && (
            <div role="alert" className="alert-error">
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? "Solving…" : "Solve"}
          </button>

          <div className="border-t border-white/10 pt-4">
            <h3 className="field-label">Examples</h3>
            <div className="flex flex-col gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="btn btn-secondary btn-sm justify-start text-left"
                  title={p.note}
                  onClick={() => {
                    setA(p.a);
                    setB(p.b);
                    setGoal(p.goal);
                    setError(null);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </form>

        <div className="card text-sm leading-6 text-slate-300">
          <h2 className="text-base font-bold text-white">How to read it</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>A <strong className="text-white">state</strong> is the pair (A, B): litres in each jug.</li>
            <li>Legal <strong className="text-white">actions</strong> are the edges between states: fill, empty, or pour one jug into the other.</li>
            <li><strong className="text-white">Explored states</strong> are states the search took out of its queue/stack and examined.</li>
          </ul>
        </div>
      </section>

      {/* ─────────── Result ─────────── */}
      <section aria-labelledby="jug-result-title" aria-live="polite" className="min-w-0 space-y-6">
        {!result && (
          <div className="card grid min-h-64 place-items-center text-center">
            <div>
              <h2 id="jug-result-title" className="text-lg font-bold text-white">
                No solution yet
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">
                Choose the jug sizes and a goal, pick BFS or DFS, and press <strong className="text-white">Solve</strong>. The
                server will search the state space and show every step here.
              </p>
            </div>
          </div>
        )}

        {result && (
          <>
            <div className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="jug-result-title" className="text-lg font-bold text-white">
                    {result.found ? "Solution found" : "No solution"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    {result.algorithm.toUpperCase()} on jugs {solved?.a} L and {solved?.b} L, goal {solved?.goal} L.
                  </p>
                </div>
                <span className={`badge ${result.found ? "" : "badge-amber"}`}>{result.found ? "Goal reached" : "Unreachable"}</span>
              </div>

              <div className={`mt-4 ${result.found ? "alert-success" : "alert-warn"}`}>{result.analysis.note}</div>

              <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="stat">
                  <dt className="stat-label">Actions</dt>
                  <dd className="stat-value">{result.metrics.actions ?? "—"}</dd>
                </div>
                <div className="stat">
                  <dt className="stat-label">Explored states</dt>
                  <dd className="stat-value">{result.metrics.explored_states}</dd>
                </div>
                <div className="stat">
                  <dt className="stat-label">Discovered states</dt>
                  <dd className="stat-value">{result.metrics.discovered_states}</dd>
                </div>
                <div className="stat">
                  <dt className="stat-label">gcd(A, B)</dt>
                  <dd className="stat-value">{result.analysis.gcd}</dd>
                </div>
              </dl>
            </div>

            {result.found && (
              <div className="card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-white">
                    Step {stepIndex} of {steps.length - 1}
                    <span className="ml-2 text-sm font-normal text-slate-300">
                      {steps[stepIndex].action === "start" ? "start with both jugs empty" : steps[stepIndex].action}
                    </span>
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPlaying(false); setStepIndex(0); }} disabled={stepIndex === 0}>
                      Restart
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPlaying(false); setStepIndex((i) => Math.max(0, i - 1)); }} disabled={stepIndex === 0}>
                      Previous
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPlaying(false); setStepIndex((i) => Math.min(steps.length - 1, i + 1)); }} disabled={stepIndex >= steps.length - 1}>
                      Next
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={steps.length <= 1}
                      onClick={() => {
                        if (stepIndex >= steps.length - 1) setStepIndex(0);
                        setPlaying((p) => !p);
                      }}
                    >
                      {running ? "Pause" : "Play"}
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex items-end justify-center gap-10 sm:gap-16">
                  <Jug name="A" amount={current[0]} capacity={capA} maxCapacity={maxCap} />
                  <Jug name="B" amount={current[1]} capacity={capB} maxCapacity={maxCap} />
                </div>
                <p className="mt-4 text-center font-mono text-sm text-slate-300">
                  state = ({current[0]}, {current[1]})
                  {atGoal(current) && <span className="ml-3 font-sans font-semibold text-emerald-300">Goal reached!</span>}
                </p>

                <ol className="mt-6 divide-y divide-white/10 rounded-xl border border-white/10">
                  {steps.map((s, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => { setPlaying(false); setStepIndex(i); }}
                        aria-current={i === stepIndex ? "step" : undefined}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${
                          i === stepIndex ? "bg-cyan-300/15 text-white" : "text-slate-300 hover:bg-white/[0.06]"
                        }`}
                      >
                        <span className="w-6 shrink-0 text-right font-mono text-xs text-slate-400">{i}</span>
                        <span className="chip">({s.state[0]}, {s.state[1]})</span>
                        <span className="flex-1">{s.action === "start" ? "Start: both jugs empty" : s.action}</span>
                        {atGoal(s.state) && <span className="badge">goal</span>}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <details className="card text-sm text-slate-300">
              <summary className="cursor-pointer font-semibold text-white">
                Explored states in order ({result.explored.length})
              </summary>
              <p className="mt-2 leading-6">
                This is the order in which {result.algorithm.toUpperCase()} examined states, including ones that are not on the
                final solution.
              </p>
              <ol className="mt-3 flex flex-wrap gap-2">
                {result.explored.map((s, i) => (
                  <li key={i} className="chip" title={`explored #${i + 1}`}>
                    <span className="mr-1.5 text-xs text-slate-400">{i + 1}.</span>({s[0]},{s[1]})
                  </li>
                ))}
              </ol>
            </details>
          </>
        )}
      </section>
    </div>
  );
}
