import { handleJsonRoute } from "@/lib/api-utils";
import { parseMazeRequest } from "@/lib/validation";
import { solveMaze } from "@/lib/algorithms/maze-search";

export const dynamic = "force-dynamic";

/** POST /api/maze/solve  { grid, start, goal, algorithm } -> found, path, visited_order, events, metrics */
export async function POST(request: Request) {
  return handleJsonRoute(request, (body) => {
    const { grid, start, goal, algorithm } = parseMazeRequest(body);
    return solveMaze(grid, start, goal, algorithm);
  });
}
