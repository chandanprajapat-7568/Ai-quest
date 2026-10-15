import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: {
    default: "AI Quest | Interactive AI Search & Puzzle Lab",
    template: "%s | AI Quest",
  },
  description:
    "AI Quest visualizes BFS, DFS, Greedy Best-First and A* on mazes, solves the Water Jug problem, plays Tic-Tac-Toe with Minimax, and analyzes English text with NLTK-based NLP.",
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <a
          href="#main"
          className="sr-only rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-slate-950 focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        >
          Skip to main content
        </a>
        <SiteHeader />
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 sm:px-6">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
