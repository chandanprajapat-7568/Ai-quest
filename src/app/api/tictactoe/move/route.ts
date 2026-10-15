import { handleJsonRoute } from "@/lib/api-utils";
import { parseTicTacToeRequest } from "@/lib/validation";
import {
  AI,
  HUMAN,
  boardToStrings,
  chooseAiMove,
  findWinner,
  indexToCell,
  outcomeOf,
} from "@/lib/algorithms/tic-tac-toe";

export const dynamic = "force-dynamic";

/**
 * POST /api/tictactoe/move  { board, human_move, difficulty }
 * The server is authoritative: it validates the board and the move, applies the human's
 * X, decides the outcome, lets the computer answer, and decides the outcome again.
 * The client never sends (or gets to choose) a winner.
 */
export async function POST(request: Request) {
  return handleJsonRoute(request, (body) => {
    const { board, moveIndex, difficulty } = parseTicTacToeRequest(body);

    board[moveIndex] = HUMAN;
    let outcome = outcomeOf(board);
    let aiMove: [number, number] | null = null;
    let moveReason = "The game ended with your move, so the computer did not move.";
    let analysis: ReturnType<typeof chooseAiMove>["analysis"] | null = null;

    if (outcome === "in_progress") {
      const decision = chooseAiMove(board, difficulty);
      board[decision.index] = AI;
      aiMove = indexToCell(decision.index);
      moveReason = decision.reason;
      analysis = decision.analysis ?? null;
      outcome = outcomeOf(board);
    }

    const winner = findWinner(board);
    return {
      board: boardToStrings(board),
      human_move: indexToCell(moveIndex),
      ai_move: aiMove,
      outcome,
      difficulty,
      move_reason: moveReason,
      winning_line: winner ? winner.line.map(indexToCell) : null,
      analysis,
    };
  });
}
