/**
 * Server-side request validation for every API route.
 * The browser also validates for convenience, but only this file is trusted.
 * Every failure throws a ValidationError (HTTP 400, code INVALID_REQUEST).
 */

import { ValidationError } from "@/lib/errors";
import { MAZE_ALGORITHMS, type Cell, type MazeAlgorithm } from "@/lib/algorithms/maze-search";
import { JUG_ALGORITHMS, type JugAlgorithm } from "@/lib/algorithms/water-jug";
import {
  DIFFICULTIES,
  findWinner,
  isFull,
  stringsToBoard,
  type Board,
  type Difficulty,
} from "@/lib/algorithms/tic-tac-toe";

export const LIMITS = {
  MAZE_MIN: 1, // the server accepts tiny mazes; the UI offers 5-30
  MAZE_MAX: 30,
  JUG_MIN: 1,
  JUG_MAX: 20,
  NLP_MAX_CHARS: 5000,
} as const;

export const NLP_OPERATIONS = ["remove_stopwords", "stemming", "pos_tag"] as const;
export type NlpOperation = (typeof NLP_OPERATIONS)[number];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

function requireObject(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) throw new ValidationError("Request body must be a JSON object.");
  return body;
}

function requireChoice<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new ValidationError(`"${field}" must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

function requireIntInRange(value: unknown, min: number, max: number, field: string): number {
  if (!isInt(value)) throw new ValidationError(`"${field}" must be a whole number.`);
  if (value < min || value > max) {
    throw new ValidationError(`"${field}" must be between ${min} and ${max}.`);
  }
  return value;
}

/* ───────────────────────────── Maze ───────────────────────────── */

function parseCell(value: unknown, field: string, rows: number, cols: number): Cell {
  if (!Array.isArray(value) || value.length !== 2 || !isInt(value[0]) || !isInt(value[1])) {
    throw new ValidationError(`"${field}" must be a [row, col] pair of whole numbers.`);
  }
  const [r, c] = value as [number, number];
  if (r < 0 || c < 0 || r >= rows || c >= cols) {
    throw new ValidationError(
      `"${field}" [${r}, ${c}] is outside the ${rows}x${cols} grid (rows 0-${rows - 1}, cols 0-${cols - 1}).`,
    );
  }
  return [r, c];
}

export function parseMazeRequest(body: unknown): {
  grid: number[][];
  start: Cell;
  goal: Cell;
  algorithm: MazeAlgorithm;
} {
  const b = requireObject(body);
  const rawGrid = b.grid;
  if (!Array.isArray(rawGrid) || rawGrid.length < LIMITS.MAZE_MIN || rawGrid.length > LIMITS.MAZE_MAX) {
    throw new ValidationError(
      `"grid" must be an array of ${LIMITS.MAZE_MIN}-${LIMITS.MAZE_MAX} rows.`,
    );
  }
  const rows = rawGrid.length;
  if (!Array.isArray(rawGrid[0])) throw new ValidationError('Each row of "grid" must be an array.');
  const cols = rawGrid[0].length;
  if (cols < LIMITS.MAZE_MIN || cols > LIMITS.MAZE_MAX) {
    throw new ValidationError(`Grid width must be between ${LIMITS.MAZE_MIN} and ${LIMITS.MAZE_MAX} columns.`);
  }

  const grid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row = rawGrid[r];
    if (!Array.isArray(row)) throw new ValidationError(`Row ${r} of "grid" must be an array.`);
    if (row.length !== cols) {
      throw new ValidationError(
        `Grid must be rectangular: row ${r} has ${row.length} columns but row 0 has ${cols}.`,
      );
    }
    const clean: number[] = [];
    for (let c = 0; c < cols; c++) {
      if (row[c] !== 0 && row[c] !== 1) {
        throw new ValidationError(`Grid cell [${r}, ${c}] must be 0 (open) or 1 (wall).`);
      }
      clean.push(row[c] as number);
    }
    grid.push(clean);
  }

  const start = parseCell(b.start, "start", rows, cols);
  const goal = parseCell(b.goal, "goal", rows, cols);
  if (grid[start[0]][start[1]] === 1) throw new ValidationError("The start cell is a wall.");
  if (grid[goal[0]][goal[1]] === 1) throw new ValidationError("The goal cell is a wall.");
  const algorithm = requireChoice(b.algorithm, MAZE_ALGORITHMS, "algorithm");
  return { grid, start, goal, algorithm };
}

/* ─────────────────────────── Water Jug ─────────────────────────── */

export function parseWaterJugRequest(body: unknown): {
  capacityA: number;
  capacityB: number;
  goal: number;
  algorithm: JugAlgorithm;
} {
  const b = requireObject(body);
  const capacityA = requireIntInRange(b.capacity_a, LIMITS.JUG_MIN, LIMITS.JUG_MAX, "capacity_a");
  const capacityB = requireIntInRange(b.capacity_b, LIMITS.JUG_MIN, LIMITS.JUG_MAX, "capacity_b");
  const goal = requireIntInRange(b.goal, 0, LIMITS.JUG_MAX, "goal");
  const largest = Math.max(capacityA, capacityB);
  if (goal > largest) {
    throw new ValidationError(
      `"goal" (${goal}) cannot be larger than the biggest jug (${largest} L): the goal is an amount inside a single jug.`,
    );
  }
  const algorithm = requireChoice(b.algorithm, JUG_ALGORITHMS, "algorithm");
  return { capacityA, capacityB, goal, algorithm };
}

/* ──────────────────────────── Tic-Tac-Toe ──────────────────────────── */

export function parseTicTacToeRequest(body: unknown): {
  board: Board;
  moveIndex: number;
  difficulty: Difficulty;
} {
  const b = requireObject(body);

  if (!Array.isArray(b.board) || b.board.length !== 3) {
    throw new ValidationError('"board" must be an array of 3 strings such as ["X..", ".O.", "..."].');
  }
  for (const [i, row] of b.board.entries()) {
    if (typeof row !== "string" || !/^[XO.]{3}$/.test(row)) {
      throw new ValidationError(
        `Board row ${i} must be exactly 3 characters, each "X", "O" or "." (empty).`,
      );
    }
  }
  const board = stringsToBoard(b.board as string[]);

  // A finished game (win or full board) accepts no more moves.
  if (findWinner(board) || isFull(board)) {
    throw new ValidationError("The game is already over. Start a new game.");
  }
  const xs = board.filter((s) => s === "X").length;
  const os = board.filter((s) => s === "O").length;
  if (xs !== os) {
    throw new ValidationError(
      `Invalid board: before the human moves, X and O must have equal counts (found X=${xs}, O=${os}). The human plays X and always moves first.`,
    );
  }

  const mv = b.human_move;
  if (!Array.isArray(mv) || mv.length !== 2 || !isInt(mv[0]) || !isInt(mv[1])) {
    throw new ValidationError('"human_move" must be a [row, col] pair of whole numbers.');
  }
  const [r, c] = mv as [number, number];
  if (r < 0 || r > 2 || c < 0 || c > 2) {
    throw new ValidationError(`"human_move" [${r}, ${c}] is out of range: rows and columns are 0-2.`);
  }
  const moveIndex = r * 3 + c;
  if (board[moveIndex] !== null) {
    throw new ValidationError(`Square [${r}, ${c}] is already taken.`);
  }

  const difficulty = requireChoice(b.difficulty, DIFFICULTIES, "difficulty");
  return { board, moveIndex, difficulty };
}

/* ─────────────────────────────── NLP ─────────────────────────────── */

export function parseNlpRequest(body: unknown): { text: string; operations: NlpOperation[] } {
  const b = requireObject(body);
  if (typeof b.text !== "string") throw new ValidationError('"text" must be a string.');
  if (b.text.trim().length === 0) throw new ValidationError("Please enter some English text to analyze.");
  if (b.text.length > LIMITS.NLP_MAX_CHARS) {
    throw new ValidationError(
      `Text is too long: ${b.text.length} characters (maximum ${LIMITS.NLP_MAX_CHARS}).`,
    );
  }
  if (!Array.isArray(b.operations) || b.operations.length === 0) {
    throw new ValidationError(
      `"operations" must be a non-empty array chosen from: ${NLP_OPERATIONS.join(", ")}.`,
    );
  }
  const ops = new Set<NlpOperation>();
  for (const op of b.operations) {
    if (typeof op !== "string" || !(NLP_OPERATIONS as readonly string[]).includes(op)) {
      throw new ValidationError(
        `Unknown operation ${JSON.stringify(op)}. Allowed operations: ${NLP_OPERATIONS.join(", ")}.`,
      );
    }
    ops.add(op as NlpOperation);
  }
  return { text: b.text, operations: NLP_OPERATIONS.filter((o) => ops.has(o)) };
}
