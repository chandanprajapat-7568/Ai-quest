"use client";

import { useState } from "react";
import type { Difficulty, Outcome } from "@/lib/algorithms/tic-tac-toe";
import { errorMessage, postJson } from "@/lib/client/api";

interface MoveResponse {
  board: string[];
  human_move: [number, number];
  ai_move: [number, number] | null;
  outcome: Outcome;
  difficulty: Difficulty;
  move_reason: string;
  winning_line: Array<[number, number]> | null;
  analysis: {
    nodes_evaluated: number;
    best_score: number;
    move_scores: Array<{ move: [number, number]; score: number }>;
  } | null;
}

const EMPTY_BOARD = ["...", "...", "..."];

const POLICIES: Record<Difficulty, { label: string; text: string }> = {
  easy: {
    label: "Easy",
    text: "Picks a random legal square. It does not look for wins or threats, so you can beat it easily.",
  },
  normal: {
    label: "Normal",
    text: "Takes a winning square if it has one, otherwise blocks yours, otherwise picks a random legal square. It only looks one move ahead, so a fork (two threats at once) beats it.",
  },
  hard: {
    label: "Hard",
    text: "Minimax over the whole game tree. It assumes you play perfectly and picks the move with the best guaranteed result. The best you can do is draw.",
  },
};

const OUTCOME_TEXT: Record<Outcome, string> = {
  human_win: "You win! 🎉",
  ai_win: "The computer (O) wins.",
  draw: "It's a draw.",
  in_progress: "",
};

const scoreText = (n: number) => (n > 0 ? `+${n}` : String(n));

export default function TicTacToeGame() {
  const [board, setBoard] = useState<string[]>(EMPTY_BOARD);
  const [difficulty, setDifficulty] = useState<Difficulty>("hard");
  const [outcome, setOutcome] = useState<Outcome>("in_progress");
  const [pending, setPending] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<MoveResponse | null>(null);
  const [winLine, setWinLine] = useState<Array<[number, number]>>([]);
  const [score, setScore] = useState({ human: 0, ai: 0, draw: 0 });

  const over = outcome !== "in_progress";
  const busy = pending !== null;
  const cellValue = (r: number, c: number): string => {
    if (pending && pending[0] === r && pending[1] === c) return "X";
    const ch = board[r][c];
    return ch === "." ? "" : ch;
  };
  const isWinCell = (r: number, c: number) => winLine.some(([wr, wc]) => wr === r && wc === c);

  const play = async (r: number, c: number) => {
    if (over || busy || board[r][c] !== ".") return;
    setError(null);
    setPending([r, c]);
    try {
      const res = await postJson<MoveResponse>("/api/tictactoe/move", {
        board,
        human_move: [r, c],
        difficulty,
      });
      setBoard(res.board);
      setOutcome(res.outcome);
      setLast(res);
      setWinLine(res.winning_line ?? []);
      if (res.outcome === "human_win") setScore((s) => ({ ...s, human: s.human + 1 }));
      else if (res.outcome === "ai_win") setScore((s) => ({ ...s, ai: s.ai + 1 }));
      else if (res.outcome === "draw") setScore((s) => ({ ...s, draw: s.draw + 1 }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(null);
    }
  };

  const newGame = () => {
    setBoard(EMPTY_BOARD);
    setOutcome("in_progress");
    setPending(null);
    setError(null);
    setLast(null);
    setWinLine([]);
  };

  let statusText: string;
  if (busy) statusText = "Computer (O) is thinking…";
  else if (over) statusText = OUTCOME_TEXT[outcome];
  else statusText = "Your turn: you are X. Click a square.";

  const analysis = last?.analysis ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <section aria-labelledby="ttt-title" className="space-y-4">
        <div className="card">
          <div className="flex items-center justify-between gap-3">
            <h2 id="ttt-title" className="text-lg font-bold text-white">
              You (X) vs Computer (O)
            </h2>
            <span className="badge badge-violet">{POLICIES[difficulty].label}</span>
          </div>

          <p
            aria-live="polite"
            className={`mt-3 rounded-xl px-4 py-3 text-center text-base font-semibold ${
              outcome === "human_win"
                ? "bg-emerald-400/15 text-emerald-100"
                : outcome === "ai_win"
                  ? "bg-rose-400/15 text-rose-100"
                  : outcome === "draw"
                    ? "bg-amber-300/15 text-amber-100"
                    : "bg-white/[0.06] text-slate-100"
            }`}
          >
            {statusText}
          </p>

          <div role="grid" aria-label="Tic-Tac-Toe board" className="mx-auto mt-4 grid max-w-sm grid-cols-3 gap-2">
            {[0, 1, 2].map((r) => (
              <div role="row" key={r} style={{ display: "contents" }}>
                {[0, 1, 2].map((c) => {
                  const v = cellValue(r, c);
                  const win = isWinCell(r, c);
                  return (
                    <button
                      key={c}
                      type="button"
                      role="gridcell"
                      onClick={() => void play(r, c)}
                      disabled={over || busy || v !== ""}
                      aria-label={`Row ${r + 1}, column ${c + 1}: ${v === "" ? "empty" : v}`}
                      className={`aspect-square rounded-2xl border text-5xl font-black transition disabled:cursor-not-allowed sm:text-6xl ${
                        win
                          ? "border-emerald-300 bg-emerald-400/20"
                          : "border-white/15 bg-white/[0.05] enabled:hover:bg-white/[0.12]"
                      } ${v === "X" ? "text-cyan-300" : "text-violet-300"}`}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {error && (
            <div role="alert" className="alert-error mt-4">
              {error}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="btn btn-primary" onClick={newGame}>
              New game
            </button>
            <dl className="flex gap-4 text-center text-sm">
              <div>
                <dt className="text-xs text-slate-400">You</dt>
                <dd className="text-lg font-bold text-cyan-200 tabular-nums">{score.human}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Draws</dt>
                <dd className="text-lg font-bold text-amber-200 tabular-nums">{score.draw}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Computer</dt>
                <dd className="text-lg font-bold text-violet-200 tabular-nums">{score.ai}</dd>
              </div>
            </dl>
          </div>
          <p className="mt-2 text-xs text-slate-400">The score lasts only until you reload the page. Nothing is saved.</p>
        </div>
      </section>

      <section className="space-y-6" aria-label="Difficulty and computer analysis">
        <div className="card">
          <fieldset>
            <legend className="field-label">Difficulty</legend>
            <div className="seg">
              {(Object.keys(POLICIES) as Difficulty[]).map((d) => (
                <label key={d} className="seg-item">
                  <input
                    type="radio"
                    name="ttt-difficulty"
                    value={d}
                    checked={difficulty === d}
                    onChange={() => setDifficulty(d)}
                    className="sr-only"
                  />
                  {POLICIES[d].label}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            <strong className="text-white">{POLICIES[difficulty].label} policy:</strong> {POLICIES[difficulty].text}
          </p>
          <p className="mt-2 text-xs text-slate-400">A new difficulty applies from the computer&apos;s next move.</p>
        </div>

        <div className="card" aria-live="polite">
          <h2 className="text-lg font-bold text-white">Last computer move</h2>
          {!last || !last.ai_move ? (
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {last ? last.move_reason : "Make your first move, then the computer's decision will be explained here."}
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                O played row {last.ai_move[0] + 1}, column {last.ai_move[1] + 1}. <span className="text-slate-300">{last.move_reason}</span>
              </p>

              {analysis && (
                <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
                  <div>
                    <p className="field-label">Minimax score per candidate move</p>
                    <div className="grid w-44 grid-cols-3 gap-1.5" role="table" aria-label="Minimax scores for each square the computer could have played">
                      {[0, 1, 2].map((r) => (
                        <div role="row" key={r} style={{ display: "contents" }}>
                          {[0, 1, 2].map((c) => {
                            const entry = analysis.move_scores.find((m) => m.move[0] === r && m.move[1] === c);
                            const chosen = last.ai_move && last.ai_move[0] === r && last.ai_move[1] === c;
                            return (
                              <div
                                role="cell"
                                key={c}
                                className={`grid aspect-square place-items-center rounded-lg border text-sm font-bold tabular-nums ${
                                  chosen
                                    ? "border-violet-300 bg-violet-400/25 text-white"
                                    : entry
                                      ? "border-white/15 bg-white/[0.05] text-slate-200"
                                      : "border-white/5 bg-transparent text-slate-500"
                                }`}
                                aria-label={entry ? `score ${scoreText(entry.score)}${chosen ? ", chosen" : ""}` : "not a candidate"}
                              >
                                {entry ? scoreText(entry.score) : "–"}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-300">
                    <li>
                      Positions evaluated: <strong className="text-white tabular-nums">{analysis.nodes_evaluated.toLocaleString()}</strong>
                    </li>
                    <li>
                      Higher is better for O. <strong className="text-white">+9</strong> = win next move,{" "}
                      <strong className="text-white">0</strong> = draw with best play, negative = loses against best play.
                    </li>
                    <li>The highlighted square was chosen (ties go to the earliest square).</li>
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="card text-sm leading-6 text-slate-300">
          <h2 className="text-base font-bold text-white">How Minimax works</h2>
          <p className="mt-2">
            Minimax imagines every future sequence of moves. On O&apos;s turns it picks the child position with the highest score; on X&apos;s
            turns it assumes the human picks the lowest. Scores: O wins = 10 − depth, X wins = depth − 10, draw = 0, so quicker wins and
            slower losses are preferred. The server checks every move and decides the winner. The browser never does.
          </p>
        </div>
      </section>
    </div>
  );
}
