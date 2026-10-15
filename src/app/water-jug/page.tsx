import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import WaterJugSolver from "@/components/water-jug/WaterJugSolver";

export const metadata: Metadata = { title: "Water Jug Challenge" };

export default function WaterJugPage() {
  return (
    <>
      <PageHeader
        eyebrow="Module 2 · State-space search"
        title="Water Jug Challenge"
        description="Given two jugs with no markings, can you measure an exact amount? The solver treats every (A, B) pair as a state and searches the graph of legal fill, empty and pour actions."
        badges={["Water Jug Problem", "State-space search", "BFS", "DFS"]}
      />
      <WaterJugSolver />
    </>
  );
}
