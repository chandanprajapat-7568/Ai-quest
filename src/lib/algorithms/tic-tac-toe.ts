/**
 * Tic-Tac-Toe rules, Minimax and the three difficulty policies.
 *
 * The human always plays X and moves first; the computer plays O.
 * Board = 9 squares in row-major order (index = row * 3 + col).
 *
 * Difficulty policies (what the code REALLY does):
 *  • easy   : picks a random legal square.
 *  • normal : 1) takes a winning square if it has one, 2) otherwise blocks X's
 *             winning square, 3) otherwise picks a random legal square. It never
 *             looks further ahead than one move, so it can be beaten by a "fork".
 *  • hard   : full Minimax over the whole game tree (no depth limit, no pruning).
 *             O maximises, X minimises. Terminal scores: O wins = 10 - depth,
 *             X wins = depth - 10, draw = 0 (depth = plies from the current
 *             position). So faster wins and slower losses are preferred. Ties
 *             between equally good moves are broken by the lowest square index.
 */

export type Mark = "X" | "O";
export type Square = Mark | null;
export type Board = Square[];
export type Difficulty = "easy" | "normal" | "hard";
export type Outcome = "human_win" | "ai_win" | "draw" | "in_progress";

export const HUMAN: Mark = "X";
export const AI: Mark = "O";
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];

export const LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const indexToCell = (i: number): [number, number] => [Math.floor(i / 3), i % 3];

export function findWinner(board: Board): { mark: Mark; line: [number, number, number] } | null {
  for (const [a, b, c] of LINES) {
    const m = board[a];
    if (m && m === board[b] && m === board[c]) return { mark: m, line: [a, b, c] };
  }
  return null;
}

export const isFull = (board: Board): boolean => board.every((s) => s !== null);

export const emptySquares = (board: Board): number[] =>
  board.reduce<number[]>((acc, s, i) => (s === null ? [...acc, i] : acc), []);

export function outcomeOf(board: Board): Outcome {
  const w = findWinner(board);
  if (w) return w.mark === HUMAN ? "human_win" : "ai_win";
  return isFull(board) ? "draw" : "in_progress";
}

export const boardToStrings = (board: Board): string[] =>
  [0, 3, 6].map((r) => board.slice(r, r + 3).map((s) => s ?? ".").join(""));

export const stringsToBoard = (rows: string[]): Board =>
  rows.join("").split("").map((ch) => (ch === "X" || ch === "O" ? ch : null));

/** First empty square where `mark` would complete a line, or null. */
export function immediateWinSquare(board: Board, mark: Mark): number | null {
  for (const i of emptySquares(board)) {
    board[i] = mark;
    const wins = findWinner(board)?.mark === mark;
    board[i] = null;
    if (wins) return i;
  }
  return null;
}

/* ───────────────────────────── Minimax ───────────────────────────── */

interface Stats {
  nodes: number;
}

/**
 * Score of `board` when `player` is about to move. `depth` counts plies from the
 * position the AI is deciding on. Positive = good for O (the AI).
 */
function minimax(board: Board, player: Mark, depth: number, stats: Stats): number {
  stats.nodes++;
  const w = findWinner(board);
  if (w) return w.mark === AI ? 10 - depth : depth - 10;
  if (isFull(board)) return 0;

  const next: Mark = player === AI ? HUMAN : AI;
  let best = player === AI ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (board[i] !== null) continue;
    board[i] = player;
    const score = minimax(board, next, depth + 1, stats);
    board[i] = null;
    best = player === AI ? Math.max(best, score) : Math.min(best, score);
  }
  return best;
}

export interface AiDecision {
  index: number;
  reason: string;
  analysis?: {
    nodes_evaluated: number;
    best_score: number;
    move_scores: Array<{ move: [number, number]; score: number }>;
  };
}

const describeScore = (score: number): string =>
  score > 0
    ? "this move leads to a forced win"
    : score === 0
      ? "with best play from both sides this ends in a draw"
      : "every move loses against perfect play, so this delays the loss most";

/**
 * Choose the computer's move. The board must be a valid position where it is O's
 * turn and at least one square is empty. `rng` is injectable for testing.
 */
export function chooseAiMove(
  board: Board,
  difficulty: Difficulty,
  rng: () => number = Math.random,
): AiDecision {
  const empties = emptySquares(board);
  if (empties.length === 0) throw new Error("No legal moves left.");
  const randomMove = () => empties[Math.floor(rng() * empties.length) % empties.length];

  if (difficulty === "easy") {
    return { index: randomMove(), reason: "Easy: picked a random legal square." };
  }

  if (difficulty === "normal") {
    const win = immediateWinSquare(board, AI);
    if (win !== null) return { index: win, reason: "Normal: took an immediate win." };
    const block = immediateWinSquare(board, HUMAN);
    if (block !== null) return { index: block, reason: "Normal: blocked X's immediate win." };
    return {
      index: randomMove(),
      reason: "Normal: no immediate win or threat, so picked a random legal square.",
    };
  }

  // Hard: Minimax over the complete game tree.
  const stats: Stats = { nodes: 0 };
  const humanThreat = immediateWinSquare(board, HUMAN);
  const moveScores: Array<{ move: [number, number]; score: number }> = [];
  let bestIndex = empties[0];
  let bestScore = -Infinity;
  for (const i of empties) {
    board[i] = AI;
    const score = minimax(board, HUMAN, 1, stats);
    board[i] = null;
    moveScores.push({ move: indexToCell(i), score });
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  board[bestIndex] = AI;
  const winsNow = findWinner(board)?.mark === AI;
  board[bestIndex] = null;

  let reason: string;
  if (winsNow) reason = "Hard (Minimax): completed three in a row, an immediate win.";
  else if (humanThreat === bestIndex)
    reason = "Hard (Minimax): blocked X's immediate win, the best-scoring move.";
  else reason = `Hard (Minimax): best score ${bestScore > 0 ? "+" : ""}${bestScore}; ${describeScore(bestScore)}.`;

  return {
    index: bestIndex,
    reason,
    analysis: { nodes_evaluated: stats.nodes, best_score: bestScore, move_scores: moveScores },
  };
}
