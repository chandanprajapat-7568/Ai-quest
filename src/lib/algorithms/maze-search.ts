/**
 * Maze search algorithms: BFS, DFS, Greedy Best-First Search and A*.
 *
 * Pure TypeScript, no framework code. Everything here is deterministic and
 * JSON-serialisable so the browser can replay it truthfully.
 *
 * ── Data model ────────────────────────────────────────────────────────────────
 *  • grid[row][col]: 0 = open, 1 = wall. Coordinates are always [row, col].
 *  • Movement: 4 directions (up, right, down, left), each move costs 1.
 *  • Neighbour order (matters for tie-breaking!): UP, RIGHT, DOWN, LEFT.
 *
 * ── Metric definitions (used by every algorithm) ─────────────────────────────
 *  • expanded_nodes   = nodes removed from the frontier and processed.
 *                       `visited_order` lists them in expansion order.
 *  • discovered_nodes = unique traversable nodes that were added to the frontier
 *                       at least once (the start node counts).
 *  • path_length      = number of MOVES on the returned path (null if no path).
 *  • elapsed_ms       = performance.now() around the search + path rebuild only
 *                       (no network, no rendering). Not a scientific benchmark.
 *
 * All four algorithms test for the goal when a node is *expanded* (removed from
 * the frontier), so the goal is always the last entry of `visited_order`.
 */

export type Cell = [number, number];
export type MazeAlgorithm = "bfs" | "dfs" | "greedy" | "astar";

export const MAZE_ALGORITHMS: readonly MazeAlgorithm[] = ["bfs", "dfs", "greedy", "astar"];

export const MAZE_ALGORITHM_LABELS: Record<MazeAlgorithm, string> = {
  bfs: "Breadth-First Search (BFS)",
  dfs: "Depth-First Search (DFS)",
  greedy: "Greedy Best-First Search",
  astar: "A* Search",
};

/** One replay step: `cell` was expanded; `discovered` were first added to the frontier by it. */
export interface SearchEvent {
  cell: Cell;
  discovered: Cell[];
}

export interface MazeMetrics {
  path_length: number | null;
  expanded_nodes: number;
  discovered_nodes: number;
  elapsed_ms: number;
}

export interface MazeSearchResult {
  found: boolean;
  algorithm: MazeAlgorithm;
  path: Cell[];
  visited_order: Cell[];
  events: SearchEvent[];
  metrics: MazeMetrics;
}

// UP, RIGHT, DOWN, LEFT
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
];

interface Context {
  grid: number[][];
  rows: number;
  cols: number;
  startIdx: number;
  goalIdx: number;
  goalRow: number;
  goalCol: number;
}

interface RawSearch {
  found: boolean;
  events: SearchEvent[];
  discoveredCount: number;
  path: Cell[];
}

export function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

const toCell = (ctx: Context, idx: number): Cell => [Math.floor(idx / ctx.cols), idx % ctx.cols];

/** Traversable neighbours of a node, in the fixed order UP, RIGHT, DOWN, LEFT. */
function neighbours(ctx: Context, idx: number): number[] {
  const r = Math.floor(idx / ctx.cols);
  const c = idx % ctx.cols;
  const out: number[] = [];
  for (const [dr, dc] of DIRECTIONS) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nc < 0 || nr >= ctx.rows || nc >= ctx.cols) continue;
    if (ctx.grid[nr][nc] !== 0) continue;
    out.push(nr * ctx.cols + nc);
  }
  return out;
}

const heuristic = (ctx: Context, idx: number): number =>
  Math.abs(Math.floor(idx / ctx.cols) - ctx.goalRow) + Math.abs((idx % ctx.cols) - ctx.goalCol);

/** Follow parent links from the goal back to the start. */
function buildPath(ctx: Context, parent: Int32Array): Cell[] {
  const path: Cell[] = [];
  let cur = ctx.goalIdx;
  while (cur !== -1) {
    path.push(toCell(ctx, cur));
    if (cur === ctx.startIdx) break;
    cur = parent[cur];
  }
  return path.reverse();
}

/* ─────────────────────────── BFS ─────────────────────────── */

/**
 * BFS: FIFO queue. A node is marked "discovered" the moment it is enqueued, so it
 * can never be queued twice. Parent links are set at discovery. Because every move
 * costs 1 and BFS expands nodes in order of distance, the first time the goal is
 * expanded its path has the fewest possible moves.
 */
function bfs(ctx: Context): RawSearch {
  const parent = new Int32Array(ctx.rows * ctx.cols).fill(-1);
  const discovered = new Uint8Array(ctx.rows * ctx.cols);
  const queue: number[] = [ctx.startIdx]; // FIFO: push at the back, read from `head`
  let head = 0;
  discovered[ctx.startIdx] = 1;
  let discoveredCount = 1;
  const events: SearchEvent[] = [];

  while (head < queue.length) {
    const cur = queue[head++];
    const event: SearchEvent = { cell: toCell(ctx, cur), discovered: [] };
    events.push(event);
    if (cur === ctx.goalIdx) {
      return { found: true, events, discoveredCount, path: buildPath(ctx, parent) };
    }
    for (const n of neighbours(ctx, cur)) {
      if (discovered[n]) continue;
      discovered[n] = 1;
      discoveredCount++;
      parent[n] = cur;
      queue.push(n);
      event.discovered.push(toCell(ctx, n));
    }
  }
  return { found: false, events, discoveredCount, path: [] };
}

/* ─────────────────────────── DFS ─────────────────────────── */

/**
 * DFS: LIFO stack. Classic graph-search version: a node is marked "expanded" when
 * it is popped, and stack entries remember which node pushed them. A node may sit
 * on the stack more than once, but it is only expanded once (its parent link is
 * the first entry that got popped). Neighbours are pushed in reverse order
 * (LEFT, DOWN, RIGHT, UP) so UP is popped first: the search prefers UP, then
 * RIGHT, DOWN, LEFT. DFS is complete on a finite grid but does NOT return a
 * shortest path.
 */
function dfs(ctx: Context): RawSearch {
  const size = ctx.rows * ctx.cols;
  const parent = new Int32Array(size).fill(-1);
  const expanded = new Uint8Array(size);
  const everDiscovered = new Uint8Array(size);
  const stack: Array<[number, number]> = [[ctx.startIdx, -1]]; // [node, node that pushed it]
  everDiscovered[ctx.startIdx] = 1;
  let discoveredCount = 1;
  const events: SearchEvent[] = [];

  while (stack.length > 0) {
    const [cur, from] = stack.pop() as [number, number];
    if (expanded[cur]) continue; // stale duplicate entry
    expanded[cur] = 1;
    parent[cur] = from;
    const event: SearchEvent = { cell: toCell(ctx, cur), discovered: [] };
    events.push(event);
    if (cur === ctx.goalIdx) {
      return { found: true, events, discoveredCount, path: buildPath(ctx, parent) };
    }
    const next = neighbours(ctx, cur);
    for (let i = next.length - 1; i >= 0; i--) {
      const n = next[i];
      if (expanded[n]) continue;
      stack.push([n, cur]);
      if (!everDiscovered[n]) {
        everDiscovered[n] = 1;
        discoveredCount++;
        event.discovered.push(toCell(ctx, n));
      }
    }
  }
  return { found: false, events, discoveredCount, path: [] };
}

/* ─────────────────────── Priority queue ─────────────────────── */

interface HeapItem {
  k1: number; // primary priority
  k2: number; // secondary priority (tie-break)
  seq: number; // insertion order (final tie-break => deterministic results)
  node: number;
  g: number; // path cost at the time of insertion (used to detect stale A* entries)
}

const less = (a: HeapItem, b: HeapItem): boolean =>
  a.k1 !== b.k1 ? a.k1 < b.k1 : a.k2 !== b.k2 ? a.k2 < b.k2 : a.seq < b.seq;

/** Small binary min-heap (array based). */
class MinHeap {
  private items: HeapItem[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: HeapItem): void {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  pop(): HeapItem | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop() as HeapItem;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && less(a[l], a[m])) m = l;
        if (r < a.length && less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

/* ─────────────────── Greedy Best-First Search ─────────────────── */

/**
 * Greedy Best-First: the frontier is a priority queue ordered by h(n) ALONE
 * (Manhattan distance to the goal). It ignores the cost already paid, so it is
 * fast but may return a path that is not the shortest. Nodes are discovered (and
 * given a parent) once, when first pushed. Ties: insertion order.
 */
function greedy(ctx: Context): RawSearch {
  const size = ctx.rows * ctx.cols;
  const parent = new Int32Array(size).fill(-1);
  const discovered = new Uint8Array(size);
  const heap = new MinHeap();
  let seq = 0;
  heap.push({ k1: heuristic(ctx, ctx.startIdx), k2: 0, seq: seq++, node: ctx.startIdx, g: 0 });
  discovered[ctx.startIdx] = 1;
  let discoveredCount = 1;
  const events: SearchEvent[] = [];

  while (heap.size > 0) {
    const { node: cur } = heap.pop() as HeapItem;
    const event: SearchEvent = { cell: toCell(ctx, cur), discovered: [] };
    events.push(event);
    if (cur === ctx.goalIdx) {
      return { found: true, events, discoveredCount, path: buildPath(ctx, parent) };
    }
    for (const n of neighbours(ctx, cur)) {
      if (discovered[n]) continue;
      discovered[n] = 1;
      discoveredCount++;
      parent[n] = cur;
      heap.push({ k1: heuristic(ctx, n), k2: 0, seq: seq++, node: n, g: 0 });
      event.discovered.push(toCell(ctx, n));
    }
  }
  return { found: false, events, discoveredCount, path: [] };
}

/* ─────────────────────────── A* ─────────────────────────── */

/**
 * A*: priority f(n) = g(n) + h(n), where g = moves so far and h = Manhattan
 * distance. Manhattan distance never overestimates on a 4-direction unit-cost grid
 * (admissible) and satisfies h(a) <= 1 + h(b) for neighbours (consistent), so the
 * first time the goal is expanded its path is optimal.
 *
 * Strategy used here:
 *  • If a cheaper route to a frontier node is found, its g/parent are updated and a
 *    NEW heap entry is pushed (heaps cannot decrease-key). The older entry becomes
 *    stale and is skipped when popped ("lazy deletion").
 *  • A closed set is kept. Because the heuristic is consistent, an expanded node
 *    never needs to be reopened, so closed nodes are never re-expanded.
 *  • Ties on f are broken by smaller h (prefer nodes closer to the goal), then by
 *    insertion order.
 */
function astar(ctx: Context): RawSearch {
  const size = ctx.rows * ctx.cols;
  const parent = new Int32Array(size).fill(-1);
  const bestG = new Int32Array(size).fill(0x7fffffff);
  const closed = new Uint8Array(size);
  const discovered = new Uint8Array(size);
  const heap = new MinHeap();
  let seq = 0;

  bestG[ctx.startIdx] = 0;
  discovered[ctx.startIdx] = 1;
  let discoveredCount = 1;
  const h0 = heuristic(ctx, ctx.startIdx);
  heap.push({ k1: h0, k2: h0, seq: seq++, node: ctx.startIdx, g: 0 });
  const events: SearchEvent[] = [];

  while (heap.size > 0) {
    const entry = heap.pop() as HeapItem;
    const cur = entry.node;
    if (closed[cur] || entry.g > bestG[cur]) continue; // stale entry
    closed[cur] = 1;
    const event: SearchEvent = { cell: toCell(ctx, cur), discovered: [] };
    events.push(event);
    if (cur === ctx.goalIdx) {
      return { found: true, events, discoveredCount, path: buildPath(ctx, parent) };
    }
    const g = bestG[cur] + 1;
    for (const n of neighbours(ctx, cur)) {
      if (closed[n] || g >= bestG[n]) continue;
      bestG[n] = g;
      parent[n] = cur;
      const h = heuristic(ctx, n);
      heap.push({ k1: g + h, k2: h, seq: seq++, node: n, g });
      if (!discovered[n]) {
        discovered[n] = 1;
        discoveredCount++;
        event.discovered.push(toCell(ctx, n));
      }
    }
  }
  return { found: false, events, discoveredCount, path: [] };
}

/* ─────────────────────────── Public API ─────────────────────────── */

/**
 * Run one search. The caller must have validated the input (rectangular grid of
 * 0/1, start/goal in bounds and not walls); see `validation.ts`.
 */
export function solveMaze(
  grid: number[][],
  start: Cell,
  goal: Cell,
  algorithm: MazeAlgorithm,
): MazeSearchResult {
  const rows = grid.length;
  const cols = grid[0].length;
  const ctx: Context = {
    grid,
    rows,
    cols,
    startIdx: start[0] * cols + start[1],
    goalIdx: goal[0] * cols + goal[1],
    goalRow: goal[0],
    goalCol: goal[1],
  };

  const t0 = performance.now();
  let raw: RawSearch;
  switch (algorithm) {
    case "bfs":
      raw = bfs(ctx);
      break;
    case "dfs":
      raw = dfs(ctx);
      break;
    case "greedy":
      raw = greedy(ctx);
      break;
    case "astar":
      raw = astar(ctx);
      break;
    default:
      throw new Error(`Unknown maze algorithm: ${String(algorithm)}`);
  }
  const elapsed = performance.now() - t0;

  return {
    found: raw.found,
    algorithm,
    path: raw.path,
    visited_order: raw.events.map((e) => e.cell),
    events: raw.events,
    metrics: {
      path_length: raw.found ? raw.path.length - 1 : null,
      expanded_nodes: raw.events.length,
      discovered_nodes: raw.discoveredCount,
      elapsed_ms: elapsed, // raw value; the UI rounds it for display only
    },
  };
}
