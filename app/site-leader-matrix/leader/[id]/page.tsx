"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { RadarBig } from "@/components/RadarBig";
import { ScoreEditor } from "@/components/ScoreEditor";
import { GradeStamp } from "@/components/GradeStamp";
import { CanonizeButton } from "@/components/CanonizeButton";
import { HistoryLog } from "@/components/HistoryLog";
import { ChangeLeaderForm } from "@/components/ChangeLeaderForm";
import { TeamThemeWrapper } from "@/components/TeamThemeWrapper";
import { SLM_BASE } from "@/lib/routes";
import { CATEGORIES } from "@/lib/categories";
import { average, gradeBand, BAND_COLORS } from "@/lib/grades";
import type { Site } from "@/lib/types";

export default function LeaderPage() {
  const params = useParams();
  const id = Number(params.id);
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/sites/${id}`);
    const data = await res.json();
    setSite(data.site ?? null);
    setLoading(false);
    setRefreshKey((k) => k + 1);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <p className="text-sm text-ink-soft">Pulling the scouting file…</p>
      </main>
    );
  }

  if (!site) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <p className="text-sm text-grade-low">Site not found.</p>
        <Link href={SLM_BASE} className="text-sm text-navy hover:underline">
          Back to division overview
        </Link>
      </main>
    );
  }

  const avg = average(site.scores.map((s) => s.score));
  const band = gradeBand(avg);
  const color = BAND_COLORS[band];
  const placeholderCount = site.scores.filter((s) => !s.is_canonized).length;

  return (
    <TeamThemeWrapper siteTopic={site.site_topic}>
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Link href={SLM_BASE} className="text-xs font-medium text-ink-soft hover:text-navy">
        ← All sites
      </Link>

      <div className="mt-2 mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <GradeStamp avg={avg} size="lg" />
          <div>
            <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
              {site.site_topic}
            </p>
            <h1 className="font-display text-3xl font-bold text-navy">{site.site_name}</h1>
            <p className="text-sm text-ink-soft">{site.leader_name}</p>
          </div>
        </div>
        <CanonizeButton
          siteId={site.id}
          count={placeholderCount}
          onDone={load}
          label={`Canonize this site (${placeholderCount})`}
        />
      </div>

      <div className="card mb-6 rounded-md p-4">
        <RadarBig site={site} color={color} />
        <p className="mt-1 text-center text-xs text-ink-soft">
          Hover a point for that quadrant&apos;s notes. Overall average:{" "}
          <strong className="text-ink">{avg.toFixed(2)}</strong>/10
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CATEGORIES.map((c) => (
          <ScoreEditor
            key={c.key}
            siteId={site.id}
            category={c.key}
            label={c.label}
            row={site.scores.find((s) => s.category === c.key)}
            onSaved={load}
          />
        ))}
      </div>

      <div className="card rounded-md p-4">
        <h2 className="font-display text-lg font-semibold text-navy">History</h2>
        <div className="mt-2">
          <HistoryLog siteId={site.id} refreshKey={refreshKey} />
        </div>
      </div>

      <div className="mt-6">
        <ChangeLeaderForm
          siteId={site.id}
          currentLeader={site.leader_name}
          onChanged={load}
        />
      </div>
    </main>
    </TeamThemeWrapper>
  );
}
