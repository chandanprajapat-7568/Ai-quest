import type { Cell } from "@/lib/algorithms/maze-search";

/**
 * Preset mazes, written as text so they are easy to read and edit.
 * '#' = wall, '.' = open, 'S' = start, 'G' = goal.
 */
export interface MazePreset {
  id: string;
  name: string;
  description: string;
  rows: string[];
}

export const MAZE_PRESETS: MazePreset[] = [
  {
    id: "demo",
    name: "Demo maze: wall with a gap",
    description:
      "A long wall splits the maze in two. The only way across is around the bottom, and the side pockets tempt greedy search.",
    rows: [
      ".......#.......",
      ".......#.......",
      "..###..#..###..",
      "..#....#....#..",
      "..#.##.#.##.#..",
      "..#.#..#..#.#..",
      "....#..#..#....",
      ".S..#..#..#..G.",
      "....#..#..#....",
      "..#.#..#..#.#..",
      "..#.##.#.##.#..",
      "..#....#....#..",
      "..###.....###..",
      "...............",
      "...............",
    ],
  },
  {
    id: "no-path",
    name: "No-path example: goal walled in",
    description: "The goal is completely surrounded by walls, so every algorithm must report 'no path'.",
    rows: [
      "..........",
      ".S........",
      "..........",
      "..........",
      "......###.",
      "......#G#.",
      "......###.",
      "..........",
      "..........",
      "..........",
    ],
  },
];

export interface ParsedMaze {
  grid: number[][];
  start: Cell;
  goal: Cell;
}

export function parsePreset(preset: MazePreset): ParsedMaze {
  let start: Cell = [0, 0];
  let goal: Cell = [preset.rows.length - 1, preset.rows[0].length - 1];
  const grid = preset.rows.map((line, r) =>
    line.split("").map((ch, c) => {
      if (ch === "S") start = [r, c];
      if (ch === "G") goal = [r, c];
      return ch === "#" ? 1 : 0;
    }),
  );
  return { grid, start, goal };
}
