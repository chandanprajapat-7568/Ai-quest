import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import TicTacToeGame from "@/components/tic-tac-toe/TicTacToeGame";

export const metadata: Metadata = { title: "Tic-Tac-Toe" };

export default function TicTacToePage() {
  return (
    <>
      <PageHeader
        eyebrow="Module 3 · Game playing"
        title="Tic-Tac-Toe vs the Computer"
        description="You are X and move first. The server validates every move, decides the winner and picks the computer's reply using the difficulty policy you choose."
        badges={["Game playing", "Game tree", "Minimax"]}
      />
      <TicTacToeGame />
    </>
  );
}
