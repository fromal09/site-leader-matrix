import Link from "next/link";
import { TOOLS } from "@/lib/tools";

export default function HubPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
          Internal Tools
        </p>
        <h1 className="font-display text-3xl font-bold text-navy sm:text-4xl">
          Sports Directors Reference Guide
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          A field guide and toolset for evaluating and developing the people who run our
          sites — grading, planning, and tracking, all in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TOOLS.map((tool) =>
          tool.status === "available" ? (
            <Link
              key={tool.slug}
              href={tool.href}
              className="card group flex flex-col rounded-md p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="font-display text-xl font-semibold text-navy">
                  {tool.name}
                </h2>
                <span className="stamp h-9 w-9 shrink-0 text-[10px] text-grade-good">
                  GO
                </span>
              </div>
              <p className="font-data text-xs uppercase tracking-wide text-ink-soft">
                {tool.tagline}
              </p>
              <p className="mt-2 text-sm text-ink">{tool.description}</p>
              <span className="mt-4 text-xs font-medium text-navy group-hover:underline">
                Open →
              </span>
            </Link>
          ) : (
            <div
              key={tool.slug}
              className="card relative flex flex-col rounded-md p-5 opacity-60"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="font-display text-xl font-semibold text-ink-soft">
                  {tool.name}
                </h2>
                <span className="stamp h-9 w-9 shrink-0 text-[9px] text-ink-soft">
                  SOON
                </span>
              </div>
              <p className="font-data text-xs uppercase tracking-wide text-ink-soft">
                {tool.tagline}
              </p>
              <p className="mt-2 text-sm text-ink-soft">{tool.description}</p>
            </div>
          )
        )}
      </div>
    </main>
  );
}
