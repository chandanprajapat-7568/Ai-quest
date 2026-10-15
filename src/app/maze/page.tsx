import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import MazeNavigator from "@/components/maze/MazeNavigator";

export const metadata: Metadata = { title: "Maze Navigator" };

export default function MazePage() {
  return (
    <>
      <PageHeader
        eyebrow="Module 1 · Search algorithms"
        title="Maze Navigator"
        description="Edit the maze, pick an algorithm and press Run. The server runs the real search and returns its expansion order; the animation replays exactly that order, then draws the final path on top."
        badges={["BFS", "DFS", "Greedy Best-First Search", "A*"]}
      />
      <MazeNavigator />
    </>
  );
}
