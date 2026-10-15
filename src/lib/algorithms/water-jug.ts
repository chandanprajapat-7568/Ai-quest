/**
 * Water Jug problem solved as a state-space search (BFS or DFS).
 *
 * State     : (a, b) = litres currently in jug A and jug B.
 * Start     : (0, 0)
 * Goal test : a === goal OR b === goal (the target amount is in either jug).
 * Operators : fill A, fill B, empty A, empty B, pour A to B, pour B to A.
 *             (Operators that would not change the state are skipped.)
 *
 * States are the nodes of a graph and legal operators are its edges.
 * Metric definitions:
 *  • explored_states   = states removed from the frontier and processed (goal included).
 *  • discovered_states = unique states ever added to the frontier (start included).
 *  • actions           = number of operators in the returned solution (null if none).
 */

export type JugAlgorithm = "bfs" | "dfs";
export type JugState = [number, number];

export interface JugStep {
  state: JugState;
  action: string;
}

export interface JugResult {
  found: boolean;
  algorithm: JugAlgorithm;
  steps: JugStep[];
  explored: JugState[];
  metrics: {
    actions: number | null;
    explored_states: number;
    discovered_states: number;
    elapsed_ms: number;
  };
  analysis: {
    gcd: number;
    reachable_by_theory: boolean;
    note: string;
  };
}

export const JUG_ALGORITHMS: readonly JugAlgorithm[] = ["bfs", "dfs"];

export function gcd(x: number, y: number): number {
  return y === 0 ? x : gcd(y, x % y);
}

interface Successor {
  state: JugState;
  action: string;
}

/** Legal operators from (a, b), in the fixed order used by both BFS and DFS. */
export function successors(a: number, b: number, capA: number, capB: number): Successor[] {
  const pourAB = Math.min(a, capB - b);
  const pourBA = Math.min(b, capA - a);
  const candidates: Successor[] = [
    { state: [capA, b], action: "fill A" },
    { state: [a, capB], action: "fill B" },
    { state: [0, b], action: "empty A" },
    { state: [a, 0], action: "empty B" },
    { state: [a - pourAB, b + pourAB], action: "pour A to B" },
    { state: [a + pourBA, b - pourBA], action: "pour B to A" },
  ];
  return candidates.filter((s) => s.state[0] !== a || s.state[1] !== b);
}

export function solveWaterJug(
  capA: number,
  capB: number,
  goal: number,
  algorithm: JugAlgorithm,
): JugResult {
  const width = capB + 1;
  const size = (capA + 1) * width;
  const key = (s: JugState) => s[0] * width + s[1];
  const fromKey = (k: number): JugState => [Math.floor(k / width), k % width];
  const isGoal = (s: JugState) => s[0] === goal || s[1] === goal;

  const parent = new Int32Array(size).fill(-1);
  const actionTo: string[] = new Array(size).fill("");
  const explored: JugState[] = [];
  let discoveredCount = 1;
  let goalKey = -1;

  const startKey = key([0, 0]);
  const t0 = performance.now();

  if (algorithm === "bfs") {
    // FIFO queue; a state is "discovered" when enqueued (so never enqueued twice).
    const seen = new Uint8Array(size);
    const queue: number[] = [startKey];
    let head = 0;
    seen[startKey] = 1;
    while (head < queue.length) {
      const cur = queue[head++];
      const state = fromKey(cur);
      explored.push(state);
      if (isGoal(state)) {
        goalKey = cur;
        break;
      }
      for (const next of successors(state[0], state[1], capA, capB)) {
        const k = key(next.state);
        if (seen[k]) continue;
        seen[k] = 1;
        discoveredCount++;
        parent[k] = cur;
        actionTo[k] = next.action;
        queue.push(k);
      }
    }
  } else {
    // LIFO stack; a state is "expanded" when popped. Successors are pushed in reverse
    // so that the first operator in the list ("fill A") is tried first.
    const expanded = new Uint8Array(size);
    const everDiscovered = new Uint8Array(size);
    const stack: Array<{ key: number; from: number; action: string }> = [
      { key: startKey, from: -1, action: "start" },
    ];
    everDiscovered[startKey] = 1;
    while (stack.length > 0) {
      const item = stack.pop() as { key: number; from: number; action: string };
      if (expanded[item.key]) continue; // stale duplicate
      expanded[item.key] = 1;
      parent[item.key] = item.from;
      actionTo[item.key] = item.action;
      const state = fromKey(item.key);
      explored.push(state);
      if (isGoal(state)) {
        goalKey = item.key;
        break;
      }
      const next = successors(state[0], state[1], capA, capB);
      for (let i = next.length - 1; i >= 0; i--) {
        const k = key(next[i].state);
        if (expanded[k]) continue;
        stack.push({ key: k, from: item.key, action: next[i].action });
        if (!everDiscovered[k]) {
          everDiscovered[k] = 1;
          discoveredCount++;
        }
      }
    }
  }

  // Rebuild the ordered state/action sequence from parent links.
  const steps: JugStep[] = [];
  if (goalKey !== -1) {
    let cur = goalKey;
    while (cur !== -1) {
      steps.push({ state: fromKey(cur), action: cur === startKey ? "start" : actionTo[cur] });
      cur = parent[cur];
    }
    steps.reverse();
  }
  const elapsed = performance.now() - t0;

  const g = gcd(capA, capB);
  const reachable = goal <= Math.max(capA, capB) && goal % g === 0;
  let note: string;
  if (goalKey !== -1) {
    note = `Goal reached: ${goal} L is in a jug. (Number theory agrees: ${goal} is a multiple of gcd(${capA}, ${capB}) = ${g}.)`;
  } else if (goal % g !== 0) {
    note = `No solution: every amount you can measure is a multiple of gcd(${capA}, ${capB}) = ${g}, and ${goal} is not.`;
  } else {
    note = `No solution found after exploring every reachable state.`;
  }

  return {
    found: goalKey !== -1,
    algorithm,
    steps,
    explored,
    metrics: {
      actions: goalKey !== -1 ? steps.length - 1 : null,
      explored_states: explored.length,
      discovered_states: discoveredCount,
      elapsed_ms: elapsed,
    },
    analysis: { gcd: g, reachable_by_theory: reachable, note },
  };
}
