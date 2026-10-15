import { handleJsonRoute } from "@/lib/api-utils";
import { parseWaterJugRequest } from "@/lib/validation";
import { solveWaterJug } from "@/lib/algorithms/water-jug";

export const dynamic = "force-dynamic";

/** POST /api/water-jug/solve  { capacity_a, capacity_b, goal, algorithm } -> found, steps, metrics */
export async function POST(request: Request) {
  return handleJsonRoute(request, (body) => {
    const { capacityA, capacityB, goal, algorithm } = parseWaterJugRequest(body);
    return solveWaterJug(capacityA, capacityB, goal, algorithm);
  });
}
