import Link from "next/link";
import { DIVISIONS } from "@/lib/divisions";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
          FanSided Network
        </p>
        <h1 className="font-display text-3xl font-bold text-navy sm:text-4xl">
          Sports Directors Reference Guide
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          A field guide and toolset for evaluating and developing the people who run our
          sites — grading, planning, and tracking, across every division.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DIVISIONS.map((division) =>
          division.status === "available" ? (
            <Link
              key={division.key}
              href={`/division/${division.key}`}
              className="card group flex flex-col rounded-md p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="font-display text-xl font-semibold text-navy">
                  {division.name}
                </h2>
                <span className="stamp h-9 w-9 shrink-0 text-[10px] text-grade-good">
                  GO
                </span>
              </div>
              <p className="font-data text-xs uppercase tracking-wide text-ink-soft">
                {division.tagline}
              </p>
              <span className="mt-4 text-xs font-medium text-navy group-hover:underline">
                Open →
              </span>
            </Link>
          ) : (
            <div
              key={division.key}
              className="card relative flex flex-col rounded-md p-5 opacity-60"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="font-display text-xl font-semibold text-ink-soft">
                  {division.name}
                </h2>
                <span className="stamp h-9 w-9 shrink-0 text-[9px] text-ink-soft">
                  SOON
                </span>
              </div>
              <p className="font-data text-xs uppercase tracking-wide text-ink-soft">
                {division.tagline}
              </p>
            </div>
          )
        )}
      </div>
    </main>
  );
}
