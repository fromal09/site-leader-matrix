"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { divisionByKey } from "@/lib/divisions";
import { TOOLS } from "@/lib/tools";

export default function DivisionHubPage() {
  const params = useParams();
  const key = String(params.key);
  const division = divisionByKey(key);

  if (!division) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <p className="text-sm text-grade-low">Unknown division.</p>
        <Link href="/" className="text-sm text-navy hover:underline">
          ← All divisions
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/" className="text-xs font-medium text-ink-soft hover:text-navy">
        ← All divisions
      </Link>

      <div className="mt-2 mb-8">
        <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
          FanSided Network
        </p>
        <h1 className="font-display text-3xl font-bold text-navy sm:text-4xl">
          {division.name}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">{division.tagline}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <Link
            key={tool.slug}
            href={`${tool.href}?division=${division.key}`}
            className="card group flex flex-col rounded-md p-5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <h2 className="font-display text-xl font-semibold text-navy">{tool.name}</h2>
              <span className="stamp h-9 w-9 shrink-0 text-[10px] text-grade-good">GO</span>
            </div>
            <p className="font-data text-xs uppercase tracking-wide text-ink-soft">
              {division.name} Division
            </p>
            <p className="mt-2 text-sm text-ink">{tool.description}</p>
            <span className="mt-4 text-xs font-medium text-navy group-hover:underline">
              Open →
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
