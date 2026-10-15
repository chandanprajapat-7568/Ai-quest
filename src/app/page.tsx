import Link from "next/link";
import type { ReactNode } from "react";

const HERO_MAZE = ["S*#....#.", "o*#.###o.", "o***#oo..", ".o#*#..o.", "..o*****G"];

const MODULES: Array<{
  href: string;
  title: string;
  description: string;
  badges: string[];
  icon: ReactNode;
}> = [
  {
    href: "/maze",
    title: "Maze Navigator",
    description:
      "Draw walls, place the start and goal, and watch BFS, DFS, Greedy Best-First or A* explore the grid step by step, with measured results.",
    badges: ["BFS", "DFS", "Best-First Search", "A*"],
    icon: (
      <path d="M4 4h16v16H4V4Zm4 4v8m4-12v6m0 4v4m4-12v8M8 8h4m0 8h4" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    href: "/water-jug",
    title: "Water Jug Challenge",
    description:
      "Measure an exact amount with two jugs. See states as graph nodes and fill, empty and pour actions as edges, solved with BFS or DFS.",
    badges: ["State-space search", "BFS", "DFS"],
    icon: (
      <path d="M8 3h8m-7 0v3l-3 4v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9l-3-4V3M6 14c2-1.5 4 1.5 6 0s4 1.5 6 0" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    href: "/tic-tac-toe",
    title: "Tic-Tac-Toe",
    description:
      "Play X against the computer on three difficulty levels. On Hard it uses Minimax and you can see the score it gave to each possible move.",
    badges: ["Game playing", "Minimax"],
    icon: (
      <path d="M9 3v18m6-18v18M3 9h18M3 15h18" strokeLinecap="round" />
    ),
  },
  {
    href: "/nlp",
    title: "NLP Analyzer",
    description:
      "Type an English sentence and run NLTK-based stop-word removal, Porter stemming and part-of-speech tagging, with every stage shown.",
    badges: ["Stop words", "Stemming", "POS tagging"],
    icon: (
      <path d="M4 18 9 6l5 12M6 14h6m4-8h4m-4 4h4m-4 4h4m-4 4h4" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
];

const STEPS = [
  {
    title: "Pick a module",
    text: "Each card is one experiment from the AI Lab syllabus. Start anywhere.",
  },
  {
    title: "Watch the algorithm",
    text: "Search moves are replayed in the exact order the server produced them, so what you see is what the algorithm did.",
  },
  {
    title: "Read the numbers",
    text: "Path length, expanded nodes, discovered nodes and timing are measured, not made up, and every metric is explained.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* ─────────── Hero ─────────── */}
      <section className="fade-up grid items-center gap-10 pt-12 pb-14 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
        <div>
          <p className="badge badge-violet">BCA Semester V · AI Lab · CCBCA521</p>
          <h1 className="mt-5 text-5xl font-black tracking-[0.08em] text-white sm:text-6xl">
            AI{" "}
            <span className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-transparent">QUEST</span>
          </h1>
          <p className="mt-3 text-xl font-semibold text-cyan-100">Interactive AI Search &amp; Puzzle Lab</p>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            AI Quest brings the search, game-playing and basic NLP experiments from the AI Lab into one interactive app. Every
            algorithm shows its states, decisions, result and measured work, so you can see how the methods differ.
          </p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Visualizing how AI searches, decides and solves.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#modules" className="btn btn-primary">
              Start exploring
            </a>
            <Link href="/about" className="btn btn-secondary">
              Help &amp; algorithm guide
            </Link>
          </div>
        </div>

        <div className="card mx-auto w-full max-w-md p-4" aria-hidden="true">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(9, minmax(0, 1fr))" }}>
            {HERO_MAZE.flatMap((row, r) =>
              row.split("").map((ch, c) => {
                const kind =
                  ch === "#" ? "wall" : ch === "*" ? "path" : ch === "o" ? "visit" : ch === "S" ? "start" : ch === "G" ? "goal" : "empty";
                return (
                  <div
                    key={`${r}-${c}`}
                    className="hero-cell"
                    data-k={kind}
                    style={kind === "path" || kind === "visit" ? { animationDelay: `${(r * 9 + c) * 0.09}s` } : undefined}
                  />
                );
              }),
            )}
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">A tiny search in progress: violet = explored, cyan = final path</p>
        </div>
      </section>

      {/* ─────────── Modules ─────────── */}
      <section id="modules" aria-labelledby="modules-title" className="scroll-mt-24">
        <h2 id="modules-title" className="text-2xl font-bold text-white">
          Choose an experiment
        </h2>
        <p className="mt-2 max-w-2xl text-slate-300">
          Four modules, each mapped to a topic in the syllabus. This is classical AI: search, game trees and text processing you
          can trace by hand. It is not a chatbot or a large language model.
        </p>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2">
          {MODULES.map((m) => (
            <li key={m.href}>
              <Link
                href={m.href}
                className="card group flex h-full flex-col transition hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-white/[0.07]"
              >
                <div className="flex items-start gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-300/20 to-violet-400/25 text-cyan-100">
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      {m.icon}
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-white">{m.title}</h3>
                    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Syllabus topics">
                      {m.badges.map((b) => (
                        <li key={b} className="badge">
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="mt-4 flex-1 text-sm leading-6 text-slate-300">{m.description}</p>
                <span className="mt-4 text-sm font-semibold text-cyan-200 group-hover:text-cyan-100">
                  Open {m.title} <span aria-hidden="true">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ─────────── How it works ─────────── */}
      <section aria-labelledby="how-title" className="mt-16">
        <h2 id="how-title" className="text-2xl font-bold text-white">
          How AI Quest works
        </h2>
        <ol className="mt-6 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-cyan-300/15 text-sm font-extrabold text-cyan-100">
                {i + 1}
              </span>
              <h3 className="mt-3 text-lg font-bold text-white">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-300">{s.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm leading-6 text-slate-400">
          The algorithms run on the server (in plain TypeScript modules); the browser only draws, sends requests and animates the
          results. Nothing you do is stored, so there are no accounts and no database.
        </p>
      </section>
    </>
  );
}
