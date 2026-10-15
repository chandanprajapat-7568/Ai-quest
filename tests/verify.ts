/**
 * AI Quest verification suite.
 *
 * Run from the project root:   npx tsx tests/verify.ts
 *
 * It does NOT need the web server. It checks the algorithms directly against
 * independent reference implementations, exhaustive searches, and real NLTK output
 * (tests/fixtures/nltk_reference.json, produced by scripts/make_nltk_reference.py).
 */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

import { solveMaze, MAZE_ALGORITHMS, type Cell, type MazeAlgorithm } from "../src/lib/algorithms/maze-search";
import { MAZE_PRESETS, parsePreset } from "../src/lib/maze-presets";
import { solveWaterJug, successors, gcd, type JugAlgorithm } from "../src/lib/algorithms/water-jug";
import {
  chooseAiMove,
  findWinner,
  isFull,
  outcomeOf,
  emptySquares,
  stringsToBoard,
  type Board,
} from "../src/lib/algorithms/tic-tac-toe";
import {
  parseMazeRequest,
  parseWaterJugRequest,
  parseTicTacToeRequest,
  parseNlpRequest,
} from "../src/lib/validation";
import { ValidationError } from "../src/lib/errors";
import { analyzeText, loadStopwords, NlpResourceError } from "../src/lib/nlp/nlp-service";
import { porterStem } from "../src/lib/nlp/porter-stemmer";
import { wordTokenize } from "../src/lib/nlp/word-tokenizer";

/* ── tiny test harness ── */
let passed = 0;
const failures: string[] = [];
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${(e as Error).message.split("\n").join("\n       ")}`);
  }
}
const section = (title: string) => console.log(`\n${title}`);
const throwsValidation = (fn: () => unknown, fragment?: string) => {
  assert.throws(fn, (err: unknown) => {
    assert.ok(err instanceof ValidationError, "expected ValidationError");
    if (fragment) assert.ok(err.message.includes(fragment), `message "${err.message}" should include "${fragment}"`);
    return true;
  });
};

/* ── helpers ── */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Independent reference: plain BFS distance (or -1). Written separately from the code under test. */
function referenceDistance(grid: number[][], s: Cell, g: Cell): number {
  const R = grid.length;
  const C = grid[0].length;
  const dist = grid.map((row) => row.map(() => -1));
  const q: Cell[] = [s];
  dist[s[0]][s[1]] = 0;
  for (let i = 0; i < q.length; i++) {
    const [r, c] = q[i];
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nc >= 0 && nr < R && nc < C && grid[nr][nc] === 0 && dist[nr][nc] === -1) {
        dist[nr][nc] = dist[r][c] + 1;
        q.push([nr, nc]);
      }
    }
  }
  return dist[g[0]][g[1]];
}

function assertLegalPath(grid: number[][], path: Cell[], s: Cell, g: Cell) {
  assert.deepEqual(path[0], s, "path must start at start");
  assert.deepEqual(path[path.length - 1], g, "path must end at goal");
  for (let i = 0; i < path.length; i++) {
    assert.equal(grid[path[i][0]][path[i][1]], 0, `path crosses a wall at ${path[i]}`);
    if (i > 0) {
      const step = Math.abs(path[i][0] - path[i - 1][0]) + Math.abs(path[i][1] - path[i - 1][1]);
      assert.equal(step, 1, `illegal move ${path[i - 1]} -> ${path[i]}`);
    }
  }
  assert.equal(new Set(path.map((p) => p.join(","))).size, path.length, "path repeats a cell");
}

/* ═══════════════════════════ MAZE ═══════════════════════════ */
section("Maze algorithms");

check("hand-checkable 3x3 maze: BFS and A* find the 4-move shortest path", () => {
  const grid = [
    [0, 0, 1],
    [1, 0, 0],
    [0, 0, 0],
  ];
  for (const alg of ["bfs", "astar"] as MazeAlgorithm[]) {
    const r = solveMaze(grid, [0, 0], [2, 2], alg);
    assert.equal(r.found, true);
    assert.equal(r.metrics.path_length, 4);
    assertLegalPath(grid, r.path, [0, 0], [2, 2]);
  }
});

check("BFS neighbour order is UP, RIGHT, DOWN, LEFT (documented tie-break)", () => {
  const grid = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const r = solveMaze(grid, [1, 1], [0, 0], "bfs");
  assert.deepEqual(r.visited_order.slice(0, 5), [[1, 1], [0, 1], [1, 2], [2, 1], [1, 0]]);
});

check("start === goal returns a zero-move path for every algorithm", () => {
  for (const alg of MAZE_ALGORITHMS) {
    const r = solveMaze([[0, 0], [0, 0]], [1, 1], [1, 1], alg);
    assert.equal(r.found, true);
    assert.deepEqual(r.path, [[1, 1]]);
    assert.equal(r.metrics.path_length, 0);
    assert.equal(r.metrics.expanded_nodes, 1);
    assert.equal(r.metrics.discovered_nodes, 1);
  }
});

check("no-path maze: found=false, empty path, valid metrics (all algorithms)", () => {
  const p = parsePreset(MAZE_PRESETS.find((m) => m.id === "no-path")!);
  for (const alg of MAZE_ALGORITHMS) {
    const r = solveMaze(p.grid, p.start, p.goal, alg);
    assert.equal(r.found, false);
    assert.deepEqual(r.path, []);
    assert.equal(r.metrics.path_length, null);
    assert.ok(r.metrics.expanded_nodes > 0);
    assert.ok(r.metrics.discovered_nodes >= r.metrics.expanded_nodes);
    assert.ok(Number.isFinite(r.metrics.elapsed_ms) && r.metrics.elapsed_ms >= 0);
  }
});

check("400 random mazes: found/optimality/metric definitions hold for all four algorithms", () => {
  const rand = mulberry32(2024);
  let foundCount = 0;
  for (let n = 0; n < 400; n++) {
    const R = 3 + Math.floor(rand() * 12);
    const C = 3 + Math.floor(rand() * 12);
    const grid = Array.from({ length: R }, () => Array.from({ length: C }, () => (rand() < 0.3 ? 1 : 0)));
    const s: Cell = [Math.floor(rand() * R), Math.floor(rand() * C)];
    const g: Cell = [Math.floor(rand() * R), Math.floor(rand() * C)];
    grid[s[0]][s[1]] = 0;
    grid[g[0]][g[1]] = 0;
    const ref = referenceDistance(grid, s, g);
    if (ref >= 0) foundCount++;

    for (const alg of MAZE_ALGORITHMS) {
      const r = solveMaze(grid, s, g, alg);
      assert.equal(r.found, ref >= 0, `${alg}: found mismatch on maze #${n}`);
      const m = r.metrics;
      assert.equal(m.expanded_nodes, r.visited_order.length);
      assert.equal(r.events.length, r.visited_order.length);
      assert.ok(m.discovered_nodes >= m.expanded_nodes);
      assert.equal(m.discovered_nodes, 1 + r.events.reduce((a, e) => a + e.discovered.length, 0));
      assert.equal(new Set(r.visited_order.map((c) => c.join(","))).size, r.visited_order.length, "a node was expanded twice");
      // every expanded node must have been discovered before (or be the start)
      const known = new Set<string>([s.join(",")]);
      for (const e of r.events) {
        assert.ok(known.has(e.cell.join(",")), `${alg}: expanded a node that was never discovered`);
        e.discovered.forEach((c) => known.add(c.join(",")));
      }
      if (r.found) {
        assertLegalPath(grid, r.path, s, g);
        assert.equal(m.path_length, r.path.length - 1);
        assert.deepEqual(r.visited_order[r.visited_order.length - 1], g, "goal must be the last expanded node");
        if (alg === "bfs" || alg === "astar") assert.equal(m.path_length, ref, `${alg} must be optimal on maze #${n}`);
        else assert.ok((m.path_length as number) >= ref);
      } else {
        assert.deepEqual(r.path, []);
        assert.equal(m.path_length, null);
      }
    }
  }
  assert.ok(foundCount > 100, "random test should include many solvable mazes");
});

check("DFS can return a non-shortest path (so it is never described as optimal)", () => {
  const p = parsePreset(MAZE_PRESETS.find((m) => m.id === "demo")!);
  const bfs = solveMaze(p.grid, p.start, p.goal, "bfs");
  const dfs = solveMaze(p.grid, p.start, p.goal, "dfs");
  assert.ok((dfs.metrics.path_length as number) > (bfs.metrics.path_length as number));
});

check("demo maze table (informational)", () => {
  const p = parsePreset(MAZE_PRESETS.find((m) => m.id === "demo")!);
  console.log("       algorithm  moves  expanded  discovered");
  for (const alg of MAZE_ALGORITHMS) {
    const r = solveMaze(p.grid, p.start, p.goal, alg);
    console.log(
      `       ${alg.padEnd(9)}  ${String(r.metrics.path_length).padStart(5)}  ${String(r.metrics.expanded_nodes).padStart(8)}  ${String(r.metrics.discovered_nodes).padStart(10)}`,
    );
  }
  const a = solveMaze(p.grid, p.start, p.goal, "astar");
  const b = solveMaze(p.grid, p.start, p.goal, "bfs");
  assert.equal(a.metrics.path_length, b.metrics.path_length);
  assert.ok(a.metrics.expanded_nodes < b.metrics.expanded_nodes, "A* should expand fewer nodes than BFS on the demo maze");
});

section("Maze request validation");
const okMaze = { grid: [[0, 0], [1, 0]], start: [0, 0], goal: [1, 1], algorithm: "astar" };
check("valid request is accepted", () => {
  const parsed = parseMazeRequest(okMaze);
  assert.equal(parsed.algorithm, "astar");
});
check("rejects wall start / wall goal", () => {
  throwsValidation(() => parseMazeRequest({ ...okMaze, start: [1, 0] }), "start cell is a wall");
  throwsValidation(() => parseMazeRequest({ ...okMaze, goal: [1, 0] }), "goal cell is a wall");
});
check("rejects out-of-bounds coordinates, non-integers and bad shapes", () => {
  throwsValidation(() => parseMazeRequest({ ...okMaze, goal: [5, 5] }), "outside");
  throwsValidation(() => parseMazeRequest({ ...okMaze, start: [0.5, 0] }));
  throwsValidation(() => parseMazeRequest({ ...okMaze, start: [0] }));
  throwsValidation(() => parseMazeRequest({ ...okMaze, start: [-1, 0] }));
});
check("rejects non-rectangular grids, bad cell values, oversize grids, unknown algorithm", () => {
  throwsValidation(() => parseMazeRequest({ ...okMaze, grid: [[0, 0], [0]] }), "rectangular");
  throwsValidation(() => parseMazeRequest({ ...okMaze, grid: [[0, 2], [0, 0]] }), "0 (open) or 1 (wall)");
  throwsValidation(() => parseMazeRequest({ ...okMaze, grid: Array.from({ length: 31 }, () => [0, 0]) }));
  throwsValidation(() => parseMazeRequest({ ...okMaze, grid: [Array(31).fill(0)] }));
  throwsValidation(() => parseMazeRequest({ ...okMaze, grid: [] }));
  throwsValidation(() => parseMazeRequest({ ...okMaze, algorithm: "dijkstra" }), "algorithm");
  throwsValidation(() => parseMazeRequest(null));
  throwsValidation(() => parseMazeRequest([1, 2]));
});

/* ═══════════════════════════ WATER JUG ═══════════════════════════ */
section("Water Jug");

function assertLegalJugSteps(res: ReturnType<typeof solveWaterJug>, capA: number, capB: number) {
  assert.deepEqual(res.steps[0], { state: [0, 0], action: "start" });
  for (let i = 1; i < res.steps.length; i++) {
    const [a, b] = res.steps[i - 1].state;
    const legal = successors(a, b, capA, capB).some(
      (s) => s.action === res.steps[i].action && s.state[0] === res.steps[i].state[0] && s.state[1] === res.steps[i].state[1],
    );
    assert.ok(legal, `step ${i} (${res.steps[i].action}) is not a legal operation from (${a},${b})`);
    assert.ok(res.steps[i].state[0] >= 0 && res.steps[i].state[0] <= capA);
    assert.ok(res.steps[i].state[1] >= 0 && res.steps[i].state[1] <= capB);
  }
}

check("classic 4L/3L goal 2 with BFS: 4 actions, every transition legal", () => {
  const r = solveWaterJug(4, 3, 2, "bfs");
  assert.equal(r.found, true);
  assert.equal(r.metrics.actions, 4);
  assertLegalJugSteps(r, 4, 3);
  const last = r.steps[r.steps.length - 1].state;
  assert.ok(last[0] === 2 || last[1] === 2);
  console.log("       " + r.steps.map((s) => `${s.action} -> (${s.state})`).join("  |  "));
});

check("classic 4L/3L goal 2 with DFS: solves it, legal transitions (may be longer)", () => {
  const r = solveWaterJug(4, 3, 2, "dfs");
  assert.equal(r.found, true);
  assertLegalJugSteps(r, 4, 3);
  assert.ok((r.metrics.actions as number) >= 4);
});

check("unreachable: 4L/6L goal 3 (gcd 2) reports no solution", () => {
  for (const alg of ["bfs", "dfs"] as JugAlgorithm[]) {
    const r = solveWaterJug(4, 6, 3, alg);
    assert.equal(r.found, false);
    assert.deepEqual(r.steps, []);
    assert.equal(r.metrics.actions, null);
    assert.ok(r.analysis.note.includes("gcd(4, 6) = 2"));
  }
});

check("goal 0 is satisfied by the start state (0 actions)", () => {
  const r = solveWaterJug(5, 3, 0, "bfs");
  assert.equal(r.found, true);
  assert.equal(r.metrics.actions, 0);
});

check("exhaustive: all capacities 1-20 and all goals; result agrees with number theory, BFS is optimal", () => {
  let runs = 0;
  for (let a = 1; a <= 20; a++) {
    for (let b = 1; b <= 20; b++) {
      const g0 = gcd(a, b);
      // independent BFS distance over the full state graph
      const dist = new Map<string, number>([["0,0", 0]]);
      const q: Array<[number, number]> = [[0, 0]];
      for (let i = 0; i < q.length; i++) {
        const [x, y] = q[i];
        for (const s of successors(x, y, a, b)) {
          const k = s.state.join(",");
          if (!dist.has(k)) {
            dist.set(k, dist.get(`${x},${y}`)! + 1);
            q.push(s.state);
          }
        }
      }
      for (let goal = 0; goal <= Math.max(a, b); goal++) {
        let best = Infinity;
        for (const [k, d] of dist) {
          const [x, y] = k.split(",").map(Number);
          if (x === goal || y === goal) best = Math.min(best, d);
        }
        for (const alg of ["bfs", "dfs"] as JugAlgorithm[]) {
          const r = solveWaterJug(a, b, goal, alg);
          runs++;
          assert.equal(r.found, goal % g0 === 0, `${alg} ${a}/${b}/${goal}`);
          assert.equal(r.found, best !== Infinity);
          if (r.found) {
            assertLegalJugSteps(r, a, b);
            if (alg === "bfs") assert.equal(r.metrics.actions, best, `BFS not optimal for ${a}/${b}/${goal}`);
          }
        }
      }
    }
  }
  console.log(`       (${runs} solver runs)`);
});

check("water jug request validation", () => {
  const ok = { capacity_a: 4, capacity_b: 3, goal: 2, algorithm: "bfs" };
  assert.equal(parseWaterJugRequest(ok).goal, 2);
  throwsValidation(() => parseWaterJugRequest({ ...ok, capacity_a: 0 }), "capacity_a");
  throwsValidation(() => parseWaterJugRequest({ ...ok, capacity_b: 21 }), "capacity_b");
  throwsValidation(() => parseWaterJugRequest({ ...ok, capacity_a: 2.5 }), "whole number");
  throwsValidation(() => parseWaterJugRequest({ ...ok, goal: -1 }), "goal");
  throwsValidation(() => parseWaterJugRequest({ ...ok, goal: 5 }), "cannot be larger");
  throwsValidation(() => parseWaterJugRequest({ ...ok, algorithm: "astar" }), "algorithm");
  throwsValidation(() => parseWaterJugRequest({ ...ok, capacity_a: "4" }));
});

/* ═══════════════════════════ TIC-TAC-TOE ═══════════════════════════ */
section("Tic-Tac-Toe");

const B = (rows: string[]): Board => stringsToBoard(rows);

check("hard AI takes an immediate win (even when X also threatens to win)", () => {
  const d = chooseAiMove(B(["OO.", "XX.", "X.."]), "hard");
  assert.equal(d.index, 2, "O should complete the top row instead of blocking");
  assert.ok(d.reason.includes("immediate win"));
});

check("hard AI blocks an immediate loss", () => {
  const d = chooseAiMove(B(["XX.", ".O.", "..."]), "hard");
  assert.equal(d.index, 2);
  assert.ok(d.reason.includes("blocked"));
});

check("normal AI takes a win first, then blocks, and never plays an occupied square", () => {
  assert.equal(chooseAiMove(B(["OO.", "XX.", "X.."]), "normal").index, 2, "win beats block");
  assert.equal(chooseAiMove(B(["XX.", ".O.", "..."]), "normal").index, 2, "block");
  const rand = mulberry32(7);
  for (let i = 0; i < 200; i++) {
    const board = B(["X..", ".O.", "..X"]);
    const d = chooseAiMove(board, i % 2 ? "easy" : "normal", rand);
    assert.equal(board[d.index], null);
  }
});

check("hard AI never loses: exhaustive over EVERY human strategy (human moves first)", () => {
  let games = 0;
  let aiWins = 0;
  let draws = 0;
  const play = (board: Board) => {
    for (const humanSq of emptySquares(board)) {
      const b = [...board];
      b[humanSq] = "X";
      const o1 = outcomeOf(b);
      if (o1 !== "in_progress") {
        assert.notEqual(o1, "human_win", "the human beat the hard AI!");
        games++;
        if (o1 === "draw") draws++;
        continue;
      }
      const d = chooseAiMove(b, "hard");
      assert.equal(b[d.index], null, "AI played an occupied square");
      b[d.index] = "O";
      const o2 = outcomeOf(b);
      if (o2 === "in_progress") play(b);
      else {
        games++;
        if (o2 === "ai_win") aiWins++;
        else draws++;
      }
    }
  };
  play(Array(9).fill(null));
  console.log(`       (${games} complete games: AI wins ${aiWins}, draws ${draws}, human wins 0)`);
});

check("game rules: win lines, draw and outcome detection", () => {
  assert.equal(findWinner(B(["XXX", "OO.", "..."]))?.mark, "X");
  assert.equal(findWinner(B(["O.X", ".OX", "..O"]))?.mark, "O");
  assert.equal(outcomeOf(B(["XOX", "XOO", "OXX"])), "draw");
  assert.equal(isFull(B(["XOX", "XOO", "OXX"])), true);
  assert.equal(outcomeOf(B(["X..", ".O.", "..."])), "in_progress");
  assert.equal(outcomeOf(B(["XXX", "OO.", "..."])), "human_win");
  assert.equal(outcomeOf(B(["OOO", "XX.", "X.."])), "ai_win");
});

check("move validation: occupied, out of range, bad board, unequal counts, finished game", () => {
  const base = { board: ["X..", ".O.", "..."], human_move: [2, 2], difficulty: "hard" };
  assert.equal(parseTicTacToeRequest(base).moveIndex, 8);
  throwsValidation(() => parseTicTacToeRequest({ ...base, human_move: [1, 1] }), "already taken");
  throwsValidation(() => parseTicTacToeRequest({ ...base, human_move: [3, 0] }), "out of range");
  throwsValidation(() => parseTicTacToeRequest({ ...base, human_move: [0, -1] }), "out of range");
  throwsValidation(() => parseTicTacToeRequest({ ...base, human_move: "2,2" }), "human_move");
  throwsValidation(() => parseTicTacToeRequest({ ...base, board: ["X..", ".O."] }), "board");
  throwsValidation(() => parseTicTacToeRequest({ ...base, board: ["X..", ".O.", "..Z"] }), "row 2");
  throwsValidation(() => parseTicTacToeRequest({ ...base, board: ["XX.", ".O.", "..."] }), "equal counts");
  throwsValidation(() => parseTicTacToeRequest({ ...base, board: ["OO.", "XXX", "..."] }), "already over");
  throwsValidation(() => parseTicTacToeRequest({ ...base, difficulty: "impossible" }), "difficulty");
  throwsValidation(() => parseTicTacToeRequest({ ...base, difficulty: undefined }), "difficulty");
});

check("post-game moves are rejected: human already won, AI already won, full board", () => {
  const after = (board: string[]) => ({ board, human_move: [2, 2], difficulty: "easy" });
  throwsValidation(() => parseTicTacToeRequest(after(["XXX", "OO.", "..."])), "already over");
  throwsValidation(() => parseTicTacToeRequest(after(["OOO", "XX.", "X.X"])), "already over");
  throwsValidation(() => parseTicTacToeRequest({ ...after(["XOX", "XOO", "OXX"]), human_move: [0, 0] }), "already over");
});

/* ═══════════════════════════ NLP ═══════════════════════════ */
section("NLP (compared with real NLTK output)");

interface RefCase {
  text: string;
  tokens: string[];
  pos: Array<[string, string]>;
}
const ref = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", "nltk_reference.json"), "utf8"),
) as { nltk_version: string; cases: RefCase[]; stems: Record<string, string> };

check("missing NLTK data -> actionable NlpResourceError (nothing is faked)", () => {
  const previous = process.env.AIQUEST_NLTK_DATA_DIR;
  process.env.AIQUEST_NLTK_DATA_DIR = path.join(process.cwd(), "does-not-exist");
  try {
    assert.throws(
      () => analyzeText("The cats run.", ["remove_stopwords"]),
      (err: unknown) => {
        assert.ok(err instanceof NlpResourceError);
        assert.equal(err.status, 503);
        assert.ok(err.message.includes('"stopwords"'));
        assert.ok(err.message.includes("python scripts/export_nltk_data.py"));
        return true;
      },
    );
    assert.throws(() => analyzeText("The cats run.", ["pos_tag"]), NlpResourceError);
    // stemming alone needs no data file, so it must still work
    assert.ok(analyzeText("The cats run.", ["stemming"]).stems);
  } finally {
    if (previous === undefined) delete process.env.AIQUEST_NLTK_DATA_DIR;
    else process.env.AIQUEST_NLTK_DATA_DIR = previous;
  }
});

check(`stop-word list matches NLTK ${ref.nltk_version} (198 words)`, () => {
  const sw = loadStopwords();
  assert.equal(sw.size, 198);
  for (const w of ["the", "are", "and", "don't", "yourselves"]) assert.ok(sw.has(w));
  assert.ok(!sw.has("cats"));
});

check(`Porter stemmer equals NLTK PorterStemmer on ${Object.keys(ref.stems).length} words`, () => {
  const bad = Object.entries(ref.stems).filter(([w, s]) => porterStem(w) !== s);
  assert.equal(bad.length, 0, `mismatches: ${bad.slice(0, 10).map(([w, s]) => `${w}: NLTK=${s} ours=${porterStem(w)}`).join("; ")}`);
});

check(`word tokenizer equals nltk.word_tokenize on ${ref.cases.length} sample texts`, () => {
  const bad = ref.cases.filter((c) => JSON.stringify(wordTokenize(c.text)) !== JSON.stringify(c.tokens));
  assert.equal(
    bad.length,
    0,
    bad.slice(0, 3).map((c) => `\n  text: ${c.text}\n  NLTK: ${JSON.stringify(c.tokens)}\n  ours: ${JSON.stringify(wordTokenize(c.text))}`).join(""),
  );
});

check(`POS tags equal nltk.pos_tag on ${ref.cases.length} sample texts`, () => {
  for (const c of ref.cases) {
    if (!c.text.trim()) continue;
    const out = analyzeText(c.text, ["pos_tag"]);
    assert.deepEqual(
      out.pos_tags!.map((p) => [p.token, p.tag]),
      c.pos,
      `POS mismatch for: ${c.text}`,
    );
  }
});

check('sample sentence "The cats are running quickly." (all operations)', () => {
  const r = analyzeText("The cats are running quickly.", ["remove_stopwords", "stemming", "pos_tag"]);
  assert.deepEqual(r.tokens, ["The", "cats", "are", "running", "quickly", "."]);
  assert.deepEqual(r.filtered_tokens, ["cats", "running", "quickly"]);
  assert.deepEqual(r.removed_stopwords, ["The", "are"]);
  assert.deepEqual(r.stems, [
    { token: "cats", stem: "cat" },
    { token: "running", stem: "run" },
    { token: "quickly", stem: "quickli" },
  ]);
  assert.deepEqual(
    r.pos_tags!.map((p) => p.tag),
    ["DT", "NNS", "VBP", "VBG", "RB", "."],
  );
  assert.equal(r.pos_tags![1].description, "plural noun");
});

check("only requested outputs are returned", () => {
  const r = analyzeText("Dogs bark.", ["stemming"]);
  assert.ok(r.stems && !r.filtered_tokens && !r.pos_tags && !r.removed_stopwords);
  const p = analyzeText("Dogs bark.", ["pos_tag"]);
  assert.ok(p.pos_tags && !p.stems && !p.filtered_tokens);
});

check("NLP request validation: empty text, over-limit text, empty/unknown operations", () => {
  const ok = { text: "The cats are running.", operations: ["remove_stopwords", "stemming", "pos_tag"] };
  assert.deepEqual(parseNlpRequest(ok).operations, ["remove_stopwords", "stemming", "pos_tag"]);
  throwsValidation(() => parseNlpRequest({ ...ok, text: "   " }), "enter some English text");
  throwsValidation(() => parseNlpRequest({ ...ok, text: "a".repeat(5001) }), "too long");
  assert.equal(parseNlpRequest({ ...ok, text: "a".repeat(5000) }).text.length, 5000);
  throwsValidation(() => parseNlpRequest({ ...ok, operations: [] }), "non-empty");
  throwsValidation(() => parseNlpRequest({ ...ok, operations: ["lemmatize"] }), "Unknown operation");
  throwsValidation(() => parseNlpRequest({ ...ok, text: 42 }), "string");
  throwsValidation(() => parseNlpRequest({ text: "hi" }), "operations");
});

/* ── summary ── */
console.log(`\n${passed} checks passed, ${failures.length} failed.`);
if (failures.length > 0) {
  console.log("Failed: " + failures.join("; "));
  process.exit(1);
}
