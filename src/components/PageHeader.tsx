import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: ReactNode;
  badges?: string[];
}

export default function PageHeader({ eyebrow, title, description, badges = [] }: PageHeaderProps) {
  return (
    <div className="fade-up pt-10 pb-8">
      <p className="text-xs font-bold tracking-[0.2em] text-cyan-200 uppercase">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">{description}</p>
      {badges.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Syllabus topics">
          {badges.map((b) => (
            <li key={b} className="badge">
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
