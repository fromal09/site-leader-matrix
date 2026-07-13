"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { dcSiteHref } from "@/lib/routes";
import type { Site } from "@/lib/types";

export default function DepthChartsHomePage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sites")
      .then((r) => r.json())
      .then((d) => setSites(d.sites ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
          Division Overview
        </p>
        <h1 className="font-display text-3xl font-bold text-navy">
          Site Depth Charts
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Click into any site to build out its writer roster. Traffic performance
          gets layered in once that data is connected.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading sites…</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sites.map((site) => (
            <Link
              key={site.id}
              href={dcSiteHref(site.id)}
              className="card group flex flex-col rounded-md p-3 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="font-display text-sm font-semibold text-navy">
                {site.site_name}
              </div>
              <div className="text-xs text-ink-soft">{site.site_topic}</div>
              <div className="mt-2 font-data text-[11px] text-ink-soft">
                {site.leader_name}
              </div>
              <span className="mt-3 text-xs font-medium text-navy group-hover:underline">
                View roster →
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
