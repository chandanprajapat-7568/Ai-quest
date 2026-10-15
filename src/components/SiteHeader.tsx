"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/maze", label: "Maze" },
  { href: "/water-jug", label: "Water Jug" },
  { href: "/tic-tac-toe", label: "Tic-Tac-Toe" },
  { href: "/nlp", label: "NLP" },
  { href: "/about", label: "Help & About" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-900/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3 rounded-lg" onClick={() => setOpen(false)}>
          <span
            aria-hidden="true"
            className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-violet-400 text-lg font-black text-slate-950"
          >
            AI
          </span>
          <span className="leading-tight">
            <span className="block text-base font-extrabold tracking-[0.18em] text-white">AI QUEST</span>
            <span className="hidden text-xs text-slate-300 sm:block">Interactive AI Search &amp; Puzzle Lab</span>
          </span>
        </Link>

        <button
          type="button"
          className="btn btn-secondary btn-sm md:hidden"
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Menu"}
        </button>

        <nav
          id="site-nav"
          aria-label="Main"
          className={`${open ? "flex" : "hidden"} absolute top-full right-0 left-0 flex-col gap-1 border-b border-white/10 bg-navy-900 p-3 md:static md:flex md:flex-row md:border-0 md:bg-transparent md:p-0`}
        >
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-cyan-300/15 text-cyan-100"
                    : "text-slate-300 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
