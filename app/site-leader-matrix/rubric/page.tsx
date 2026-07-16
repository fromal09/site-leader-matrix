"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SLM_BASE } from "@/lib/routes";
import { CATEGORIES } from "@/lib/categories";
import { RUBRIC } from "@/lib/rubric";

function RubricInner() {
  const searchParams = useSearchParams();
  const division = searchParams.get("division") ?? "NFL";

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Link
        href={`${SLM_BASE}?division=${division}`}
        className="text-xs font-medium text-ink-soft hover:text-navy"
      >
        ← All sites
      </Link>

      <div className="mt-2 mb-6">
        <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
          Reference
        </p>
        <h1 className="font-display text-3xl font-bold text-navy">
          Grading Rubric
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          What each quadrant actually measures, what it looks like when a site leader
          has it, and how we spot it when evaluating candidates.
        </p>
      </div>

      <div className="space-y-6">
        {CATEGORIES.map((c) => {
          const entry = RUBRIC[c.key];
          return (
            <section key={c.key} id={c.key} className="card scroll-mt-6 rounded-md p-5">
              <h2 className="font-display text-xl font-semibold text-navy">
                {c.label}
              </h2>

              <div className="mt-4 grid gap-5 sm:grid-cols-3">
                <div>
                  <h3 className="font-data text-xs uppercase tracking-wide text-ink-soft">
                    Key traits
                  </h3>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink">
                    {entry.traits.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-data text-xs uppercase tracking-wide text-ink-soft">
                    What this looks like in practice
                  </h3>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink">
                    {entry.practice.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-data text-xs uppercase tracking-wide text-ink-soft">
                    How we spot it in candidates
                  </h3>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink">
                    {entry.spot.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

export default function RubricPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <p className="text-sm text-ink-soft">Loading…</p>
        </main>
      }
    >
      <RubricInner />
    </Suspense>
  );
}
