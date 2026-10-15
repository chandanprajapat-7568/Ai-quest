"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  MAZE_ALGORITHMS,
  MAZE_ALGORITHM_LABELS,
  type Cell,
  type MazeAlgorithm,
  type MazeMetrics,
  type MazeSearchResult,
} from "@/lib/algorithms/maze-search";
import { MAZE_PRESETS, parsePreset, type ParsedMaze } from "@/lib/maze-presets";
import { errorMessage, postJson } from "@/lib/client/api";

const MIN_SIZE = 5;
const MAX_SIZE = 30;
// milliseconds per replay step for speed 1 (slow) ... 10 (fast)
const DELAYS = [700, 400, 250, 150, 90, 55, 32, 18, 9, 4];

type Tool = "wall" | "start" | "goal";
type Drag = { kind: "wall"; value: 0 | 1 } | { kind: "start" } | { kind: "goal" };
type Kind = "empty" | "wall" | "frontier" | "visited" | "path";
const KIND_NAMES: Kind[] = ["empty", "wall", "frontier", "visited", "path"];

const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

interface CellProps {
  r: number;
  c: number;
  kind: Kind;
  role: "start" | "goal" | "none";
  tabbable: boolean;
}

const KIND_LABEL: Record<Kind, string> = {
  empty: "empty",
  wall: "wall",
  frontier: "discovered, waiting in the frontier",
  visited: "expanded",
  path: "on the final path",
};

const MazeCell = memo(function MazeCell({ r, c, kind, role, tabbable }: CellProps) {
  const label = role === "start" ? "start" : role === "goal" ? "goal" : KIND_LABEL[kind];
  return (
    <div
      role="gridcell"
      tabIndex={tabbable ? 0 : -1}
      data-r={r}
      data-c={c}
      data-kind={kind}
      data-role={role === "none" ? undefined : role}
      aria-label={`Row ${r + 1}, column ${c + 1}: ${label}`}
      className="maze-cell"
    >
      {role === "start" ? "S" : role === "goal" ? "G" : null}
    </div>
  );
});

const fmtMs = (ms: number) => (ms < 0.001 ? "<0.001" : ms.toFixed(3));

interface RunSummary {
  found: boolean;
  metrics: MazeMetrics;
}

export default function MazeNavigator() {
  const [maze, setMaze] = useState<ParsedMaze>(() => parsePreset(MAZE_PRESETS[0]));
  const workRef = useRef<ParsedMaze>(maze); // always the latest maze, even between renders (fast drags)
  const commitMaze = useCallback((next: ParsedMaze) => {
    workRef.current = next;
    setMaze(next);
  }, []);

  const [tool, setTool] = useState<Tool>("wall");
  const [algorithm, setAlgorithm] = useState<MazeAlgorithm>("bfs");
  const [speed, setSpeed] = useState(6);
  const [result, setResult] = useState<MazeSearchResult | null>(null);
  const [t, setT] = useState(0); // replay position: 0..events.length (exploration) then path reveal
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<Partial<Record<MazeAlgorithm, RunSummary>>>({});
  const [cursor, setCursor] = useState<Cell>([0, 0]);

  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const lastCellRef = useRef("");

  const { grid, start, goal } = maze;
  const rows = grid.length;
  const cols = grid[0].length;

  const eventsTotal = result?.events.length ?? 0;
  const total = result ? eventsTotal + result.path.length : 0;
  const finished = result !== null && t >= total;
  const running = playing && result !== null && !finished;
  const delay = DELAYS[speed - 1];

  /* ───────────── run / replay control ───────────── */

  const clearRun = useCallback(() => {
    setResult(null);
    setT(0);
    setPlaying(false);
    setError(null);
  }, []);

  /** Any change to the maze makes the previous run (and the comparison table) out of date. */
  const mazeEdited = useCallback(() => {
    clearRun();
    setComparison({});
  }, [clearRun]);

  const runSearch = useCallback(
    async (mode: "play" | "step") => {
      const cur = workRef.current;
      setLoading(true);
      setError(null);
      setPlaying(false);
      try {
        const res = await postJson<MazeSearchResult>("/api/maze/solve", {
          grid: cur.grid,
          start: cur.start,
          goal: cur.goal,
          algorithm,
        });
        setResult(res);
        setT(mode === "step" ? 1 : 0);
        setPlaying(mode === "play");
        setComparison((prev) => ({ ...prev, [algorithm]: { found: res.found, metrics: res.metrics } }));
      } catch (e) {
        setResult(null);
        setT(0);
        setError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [algorithm],
  );

  // Advance the replay one step at a time. It only ever replays events returned by the server.
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => setT((x) => Math.min(x + 1, total)), delay);
    return () => window.clearTimeout(id);
  }, [running, t, total, delay]);

  const onStep = () => {
    if (!result) {
      void runSearch("step");
    } else {
      setPlaying(false);
      setT((x) => Math.min(x + 1, total));
    }
  };

  const onPauseResume = () => {
    if (!result || finished) return;
    setPlaying((p) => !p);
  };

  /* ───────────── maze editing ───────────── */

  const paintWall = useCallback(
    (r: number, c: number, value: 0 | 1) => {
      const cur = workRef.current;
      if (same(cur.start, [r, c]) || same(cur.goal, [r, c])) return;
      if (cur.grid[r][c] === value) return;
      const nextGrid = cur.grid.slice();
      nextGrid[r] = nextGrid[r].slice();
      nextGrid[r][c] = value;
      commitMaze({ ...cur, grid: nextGrid });
      mazeEdited();
    },
    [commitMaze, mazeEdited],
  );

  const moveMarker = useCallback(
    (kind: "start" | "goal", r: number, c: number) => {
      const cur = workRef.current;
      const other = kind === "start" ? cur.goal : cur.start;
      const self = kind === "start" ? cur.start : cur.goal;
      if (same(other, [r, c]) || same(self, [r, c])) return;
      let nextGrid = cur.grid;
      if (cur.grid[r][c] === 1) {
        nextGrid = cur.grid.slice();
        nextGrid[r] = nextGrid[r].slice();
        nextGrid[r][c] = 0; // a marker replaces a wall
      }
      commitMaze({ ...cur, grid: nextGrid, [kind]: [r, c] as Cell });
      mazeEdited();
    },
    [commitMaze, mazeEdited],
  );

  const applyDrag = useCallback(
    (drag: Drag, r: number, c: number) => {
      if (drag.kind === "wall") paintWall(r, c, drag.value);
      else moveMarker(drag.kind, r, c);
    },
    [paintWall, moveMarker],
  );

  const cellFromPoint = (x: number, y: number): Cell | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-r]");
    if (!el || !gridRef.current?.contains(el)) return null;
    return [Number(el.dataset.r), Number(el.dataset.c)];
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const cur = workRef.current;
    let drag: Drag;
    if (same(cell, cur.start)) drag = { kind: "start" };
    else if (same(cell, cur.goal)) drag = { kind: "goal" };
    else if (tool === "start") drag = { kind: "start" };
    else if (tool === "goal") drag = { kind: "goal" };
    else drag = { kind: "wall", value: cur.grid[cell[0]][cell[1]] === 1 ? 0 : 1 };
    dragRef.current = drag;
    lastCellRef.current = `${cell[0]},${cell[1]}`;
    setCursor(cell);
    applyDrag(drag, cell[0], cell[1]);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    const key = `${cell[0]},${cell[1]}`;
    if (key === lastCellRef.current) return;
    lastCellRef.current = key;
    applyDrag(drag, cell[0], cell[1]);
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const focusCell = (r: number, c: number) => {
    window.requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`)?.focus();
    });
  };

  const cur: Cell = [Math.min(cursor[0], rows - 1), Math.min(cursor[1], cols - 1)];

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    let next: Cell | null = null;
    switch (e.key) {
      case "ArrowUp":
        next = [Math.max(0, cur[0] - 1), cur[1]];
        break;
      case "ArrowDown":
        next = [Math.min(rows - 1, cur[0] + 1), cur[1]];
        break;
      case "ArrowLeft":
        next = [cur[0], Math.max(0, cur[1] - 1)];
        break;
      case "ArrowRight":
        next = [cur[0], Math.min(cols - 1, cur[1] + 1)];
        break;
      case "Enter":
      case " ": {
        e.preventDefault();
        const m = workRef.current;
        if (tool === "wall") paintWall(cur[0], cur[1], m.grid[cur[0]][cur[1]] === 1 ? 0 : 1);
        else moveMarker(tool, cur[0], cur[1]);
        return;
      }
      default:
        return;
    }
    e.preventDefault();
    setCursor(next);
    focusCell(next[0], next[1]);
  };

  const resizeMaze = (newRows: number, newCols: number) => {
    const m = workRef.current;
    const clamp = (cell: Cell): Cell => [Math.min(cell[0], newRows - 1), Math.min(cell[1], newCols - 1)];
    let s = clamp(m.start);
    let g = clamp(m.goal);
    if (same(s, g)) {
      g = [newRows - 1, newCols - 1];
      if (same(s, g)) s = [0, 0];
    }
    const nextGrid = Array.from({ length: newRows }, (_, r) =>
      Array.from({ length: newCols }, (_, c) => m.grid[r]?.[c] ?? 0),
    );
    nextGrid[s[0]][s[1]] = 0;
    nextGrid[g[0]][g[1]] = 0;
    commitMaze({ grid: nextGrid, start: s, goal: g });
    mazeEdited();
  };

  const clearWalls = () => {
    const m = workRef.current;
    commitMaze({ ...m, grid: m.grid.map((row) => row.map(() => 0)) });
    mazeEdited();
  };

  const loadPreset = (id: string) => {
    const preset = MAZE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    commitMaze(parsePreset(preset));
    setCursor([0, 0]);
    mazeEdited();
  };

  /* ───────────── what each cell looks like right now ───────────── */

  const view = useMemo(() => {
    const arr = new Uint8Array(rows * cols);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (grid[r][c] === 1) arr[r * cols + c] = 1;
    if (result) {
      const expanded = Math.min(t, result.events.length);
      for (let i = 0; i < expanded; i++) {
        for (const [r, c] of result.events[i].discovered) arr[r * cols + c] = 2; // frontier
      }
      for (let i = 0; i < expanded; i++) {
        const [r, c] = result.events[i].cell;
        arr[r * cols + c] = 3; // expanded
      }
      const pathCount = Math.min(Math.max(0, t - result.events.length), result.path.length);
      for (let i = 0; i < pathCount; i++) {
        const [r, c] = result.path[i];
        arr[r * cols + c] = 4; // final path overlay (only after exploration is replayed)
      }
    }
    return arr;
  }, [grid, result, t, rows, cols]);

  /* ───────────── status text ───────────── */

  const label = MAZE_ALGORITHM_LABELS[algorithm];
  let status: string;
  if (loading) status = `Asking the server to run ${label}…`;
  else if (!result) status = "Ready. Edit the maze, choose an algorithm, then press Run or Step.";
  else if (t < eventsTotal)
    status = `Replaying exploration: ${t} of ${eventsTotal} expansions${running ? "" : " (paused)"}.`;
  else if (t < total) status = `Exploration replayed. Drawing the final path (${t - eventsTotal} of ${result.path.length} cells)…`;
  else if (result.found) status = `Done. ${MAZE_ALGORITHM_LABELS[result.algorithm]} found a path of ${result.metrics.path_length} moves.`;
  else status = `Done. ${MAZE_ALGORITHM_LABELS[result.algorithm]} explored everything reachable and found no path.`;

  const progress = total > 0 ? Math.round((t / total) * 100) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
      {/* ─────────── Left: the grid ─────────── */}
      <section aria-labelledby="maze-grid-title" className="min-w-0">
        <div className="card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="maze-grid-title" className="text-lg font-bold text-white">
              Maze {rows} × {cols}
            </h2>
            <fieldset>
              <legend className="sr-only">Editing tool</legend>
              <div className="seg">
                {(
                  [
                    ["wall", "Draw / erase walls"],
                    ["start", "Place start"],
                    ["goal", "Place goal"],
                  ] as Array<[Tool, string]>
                ).map(([value, text]) => (
                  <label key={value} className="seg-item">
                    <input
                      type="radio"
                      name="maze-tool"
                      value={value}
                      checked={tool === value}
                      onChange={() => setTool(value)}
                      className="sr-only"
                    />
                    {text}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="mx-auto w-full" style={{ maxWidth: `${Math.min(46, Math.max(24, (cols / rows) * 40))}rem` }}>
            <div
              ref={gridRef}
              role="grid"
              aria-label={`Maze editor, ${rows} rows by ${cols} columns. Use arrow keys to move and Space or Enter to apply the selected tool.`}
              aria-rowcount={rows}
              aria-colcount={cols}
              className="maze-grid"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, ["--cols" as string]: cols }}
              onFocus={(e) => {
                // keep the keyboard cursor in sync with whichever cell has focus (Tab, click or arrow keys)
                const el = (e.target as HTMLElement).closest<HTMLElement>("[data-r]");
                if (el) setCursor([Number(el.dataset.r), Number(el.dataset.c)]);
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={onKeyDown}
            >
              {Array.from({ length: rows }, (_, r) => (
                <div role="row" key={r} style={{ display: "contents" }}>
                  {Array.from({ length: cols }, (_, c) => (
                    <MazeCell
                      key={c}
                      r={r}
                      c={c}
                      kind={KIND_NAMES[view[r * cols + c]]}
                      role={same(start, [r, c]) ? "start" : same(goal, [r, c]) ? "goal" : "none"}
                      tabbable={r === cur[0] && c === cur[1]}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-400">
            Click or drag on empty cells to draw walls; click or drag over walls to erase. Drag the green{" "}
            <strong className="text-slate-200">S</strong> or red <strong className="text-slate-200">G</strong> to move them
            (or pick “Place start/goal”). Keyboard: arrow keys move, Space/Enter applies the tool.
          </p>

          <div className="mt-4 border-t border-white/10 pt-3">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-300 uppercase">Legend</h3>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-200">
              <li><span className="swatch" style={{ background: "var(--cell-empty)" }} /> Empty</li>
              <li><span className="swatch" style={{ background: "var(--cell-wall)" }} /> Wall</li>
              <li><span className="swatch" style={{ background: "var(--cell-start)" }} /> Start (S)</li>
              <li><span className="swatch" style={{ background: "var(--cell-goal)" }} /> Goal (G)</li>
              <li><span className="swatch" style={{ background: "var(--cell-frontier)" }} /> Frontier (discovered, not yet expanded)</li>
              <li><span className="swatch" style={{ background: "var(--cell-visited)" }} /> Expanded</li>
              <li><span className="swatch" style={{ background: "var(--cell-path)" }} /> Final path</li>
            </ul>
          </div>
        </div>

        {/* Comparison table */}
        {Object.keys(comparison).length > 0 && (
          <div className="card mt-6">
            <h2 className="text-lg font-bold text-white">Compare algorithms on this maze</h2>
            <p className="mt-1 text-sm text-slate-300">
              Each row is the latest run of that algorithm on the maze as it is now. Editing the maze clears this table.
            </p>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">Algorithm</th>
                    <th scope="col">Result</th>
                    <th scope="col">Path (moves)</th>
                    <th scope="col">Expanded</th>
                    <th scope="col">Discovered</th>
                    <th scope="col">Algorithm time (ms)</th>
                  </tr>
                </thead>
                <tbody>
                  {MAZE_ALGORITHMS.filter((a) => comparison[a]).map((a) => {
                    const s = comparison[a] as RunSummary;
                    return (
                      <tr key={a}>
                        <th scope="row" className="px-3 py-2.5 text-left font-semibold text-white">
                          {MAZE_ALGORITHM_LABELS[a]}
                        </th>
                        <td>{s.found ? "Path found" : "No path"}</td>
                        <td className="tabular-nums">{s.metrics.path_length ?? "—"}</td>
                        <td className="tabular-nums">{s.metrics.expanded_nodes}</td>
                        <td className="tabular-nums">{s.metrics.discovered_nodes}</td>
                        <td className="tabular-nums">{fmtMs(s.metrics.elapsed_ms)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              Timings are tiny and vary from run to run, so treat them as a rough hint, not a benchmark. Compare the
              “Expanded” column to see how much work each strategy did.
            </p>
          </div>
        )}
      </section>

      {/* ─────────── Right: controls + results ─────────── */}
      <aside aria-label="Maze controls and results" className="space-y-6">
        <div className="card space-y-4">
          <div>
            <label htmlFor="maze-algorithm" className="field-label">
              Algorithm
            </label>
            <select
              id="maze-algorithm"
              className="input"
              value={algorithm}
              onChange={(e) => {
                setAlgorithm(e.target.value as MazeAlgorithm);
                clearRun();
              }}
            >
              {MAZE_ALGORITHMS.map((a) => (
                <option key={a} value={a}>
                  {MAZE_ALGORITHM_LABELS[a]}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-5 text-slate-400">{ALGORITHM_BLURB[algorithm]}</p>
          </div>

          <div>
            <label htmlFor="maze-speed" className="field-label">
              Replay speed: <span className="text-cyan-200 normal-case">{speed <= 3 ? "slow" : speed <= 7 ? "medium" : "fast"}</span>
            </label>
            <input
              id="maze-speed"
              type="range"
              min={1}
              max={10}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full accent-cyan-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="maze-rows" className="field-label">
                Rows: {rows}
              </label>
              <input
                id="maze-rows"
                type="range"
                min={MIN_SIZE}
                max={MAX_SIZE}
                value={rows}
                onChange={(e) => resizeMaze(Number(e.target.value), cols)}
                className="w-full accent-violet-300"
              />
            </div>
            <div>
              <label htmlFor="maze-cols" className="field-label">
                Columns: {cols}
              </label>
              <input
                id="maze-cols"
                type="range"
                min={MIN_SIZE}
                max={MAX_SIZE}
                value={cols}
                onChange={(e) => resizeMaze(rows, Number(e.target.value))}
                className="w-full accent-violet-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-primary" onClick={() => void runSearch("play")} disabled={loading}>
              {loading ? "Running…" : "Run"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onPauseResume} disabled={!result || finished}>
              {running ? "Pause" : "Resume"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onStep} disabled={loading || finished}>
              Step
            </button>
            <button type="button" className="btn btn-secondary" onClick={clearRun} disabled={loading || (!result && !error)}>
              Reset
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 border-t border-white/10 pt-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {MAZE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="btn btn-secondary btn-sm"
                title={p.description}
                onClick={() => loadPreset(p.id)}
              >
                {p.id === "demo" ? "Load Demo Maze" : "Load No-Path Example"}
              </button>
            ))}
            <button type="button" className="btn btn-danger btn-sm sm:col-span-2 lg:col-span-1 xl:col-span-2" onClick={clearWalls}>
              Clear Walls
            </button>
          </div>
        </div>

        <div className="card space-y-4" aria-live="polite">
          <div>
            <h2 className="text-lg font-bold text-white">Result</h2>
            <p className="mt-1 text-sm text-slate-300">{status}</p>
            {result && total > 0 && (
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-label="Replay progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div className="h-full bg-gradient-to-r from-cyan-300 to-violet-300 transition-[width]" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>

          {error && (
            <div role="alert" className="alert-error">
              {error}
            </div>
          )}

          {result && !result.found && (
            <div className="alert-warn">
              <strong>No path exists.</strong> The goal cannot be reached from the start with the current walls. The
              purple cells show every cell the algorithm could reach before it ran out of options.
            </div>
          )}

          {result && (
            <>
              <dl className="grid grid-cols-2 gap-2">
                <div className="stat col-span-2">
                  <dt className="stat-label">Algorithm</dt>
                  <dd className="mt-0.5 font-semibold text-white">{MAZE_ALGORITHM_LABELS[result.algorithm]}</dd>
                </div>
                <div className="stat">
                  <dt className="stat-label">Status</dt>
                  <dd className="stat-value text-base">{result.found ? "Path found" : "No path"}</dd>
                </div>
                <div className="stat">
                  <dt className="stat-label">Path length</dt>
                  <dd className="stat-value">{result.metrics.path_length ?? "—"}<span className="ml-1 text-xs font-normal text-slate-400">moves</span></dd>
                </div>
                <div className="stat">
                  <dt className="stat-label">Expanded nodes</dt>
                  <dd className="stat-value">{result.metrics.expanded_nodes}</dd>
                </div>
                <div className="stat">
                  <dt className="stat-label">Discovered nodes</dt>
                  <dd className="stat-value">{result.metrics.discovered_nodes}</dd>
                </div>
                <div className="stat col-span-2">
                  <dt className="stat-label">Algorithm time</dt>
                  <dd className="stat-value">{fmtMs(result.metrics.elapsed_ms)}<span className="ml-1 text-xs font-normal text-slate-400">ms (search only)</span></dd>
                </div>
              </dl>
            </>
          )}

          <details className="rounded-xl border border-white/10 bg-navy-950/40 px-3 py-2 text-sm text-slate-300">
            <summary className="cursor-pointer font-semibold text-slate-100">What do these numbers mean?</summary>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-6">
              <li><strong className="text-white">Path length</strong>: number of moves (steps between neighbouring cells) on the final path.</li>
              <li><strong className="text-white">Expanded nodes</strong>: cells taken out of the frontier and processed. These are the purple cells, in the order they were replayed.</li>
              <li><strong className="text-white">Discovered nodes</strong>: unique open cells that were ever added to the frontier, including the start.</li>
              <li><strong className="text-white">Algorithm time</strong>: measured on the server around the search only, not the network or the animation. Small runs are noisy, so this is not a benchmark.</li>
              <li>The final path (yellow) is drawn <em>after</em> the exploration replay; it is not the traversal itself.</li>
            </ul>
          </details>
        </div>
      </aside>
    </div>
  );
}

const ALGORITHM_BLURB: Record<MazeAlgorithm, string> = {
  bfs: "Explores in rings using a FIFO queue. On this grid (every move costs 1) it always finds a shortest path.",
  dfs: "Dives as deep as possible using a LIFO stack (preference: up, right, down, left). It finds a path if one exists, but not necessarily the shortest.",
  greedy: "Always expands the frontier cell with the smallest Manhattan distance to the goal, h(n). Fast, but it can return a longer path.",
  astar: "Expands the smallest f(n) = g(n) + h(n), with Manhattan distance as h. This heuristic is admissible and consistent here, so the path is shortest.",
};
