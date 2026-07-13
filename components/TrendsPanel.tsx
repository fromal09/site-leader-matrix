"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { computeDivisionStats } from "@/lib/stats";
import { categoryLabel } from "@/lib/categories";
import { slmLeaderHref } from "@/lib/routes";
import type { Site } from "@/lib/types";
import { useAuth } from "./AuthProvider";

export function TrendsPanel({ sites }: { sites: Site[] }) {
  const stats = computeDivisionStats(sites);
  const { requireAuth, session } = useAuth();
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [meta, setMeta] = useState<{ updated_at?: string; updated_by?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/division-notes")
      .then((r) => r.json())
      .then((d) => {
        setContent(d.note?.content ?? "");
        setMeta({ updated_at: d.note?.updated_at, updated_by: d.note?.updated_by });
      });
  }, []);

  function startEdit() {
    if (!requireAuth()) return;
    setDraft(content);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/division-notes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft }),
    });
    setSaving(false);
    if (res.ok) {
      setContent(draft);
      setMeta({ updated_at: new Date().toISOString(), updated_by: session?.name });
      setEditing(false);
    }
  }

  return (
    <div className="card rounded-md p-4">
      <h2 className="font-display text-lg font-semibold text-navy">
        Division Trends &amp; Areas for Improvement
      </h2>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="font-data text-xs uppercase tracking-wide text-ink-soft">
            Category strength
          </h3>
          <ul className="mt-1 space-y-1 text-sm">
            {stats.strongestCategory && (
              <li>
                <span className="text-grade-good">▲</span> Strongest:{" "}
                <strong>{stats.strongestCategory.label}</strong> (
                {stats.strongestCategory.avg.toFixed(2)} avg)
              </li>
            )}
            {stats.weakestCategory && (
              <li>
                <span className="text-grade-low">▼</span> Weakest:{" "}
                <strong>{stats.weakestCategory.label}</strong> (
                {stats.weakestCategory.avg.toFixed(2)} avg)
              </li>
            )}
          </ul>

          <h3 className="mt-3 font-data text-xs uppercase tracking-wide text-ink-soft">
            Biggest internal gaps (one quadrant carrying/dragging the rest)
          </h3>
          <ul className="mt-1 space-y-1 text-sm">
            {stats.biggestGaps.map((g) => (
              <li key={g.site.id}>
                <Link href={slmLeaderHref(g.site.id)} className="hover:text-navy hover:underline">
                  {g.site.site_name}
                </Link>{" "}
                — {g.gap.toFixed(0)} pt gap ({categoryLabel(g.high)} vs {categoryLabel(g.low)})
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-data text-xs uppercase tracking-wide text-ink-soft">
            Needs attention (lowest overall average)
          </h3>
          <ul className="mt-1 space-y-1 text-sm">
            {stats.needsAttention.map((n) => (
              <li key={n.site.id} className="flex justify-between">
                <Link href={slmLeaderHref(n.site.id)} className="hover:text-navy hover:underline">
                  {n.site.site_name}
                </Link>
                <span className="font-data text-grade-low">{n.avg.toFixed(2)}</span>
              </li>
            ))}
          </ul>

          <h3 className="mt-3 font-data text-xs uppercase tracking-wide text-ink-soft">
            Top performers
          </h3>
          <ul className="mt-1 space-y-1 text-sm">
            {stats.topPerformers.map((n) => (
              <li key={n.site.id} className="flex justify-between">
                <Link href={slmLeaderHref(n.site.id)} className="hover:text-navy hover:underline">
                  {n.site.site_name}
                </Link>
                <span className="font-data text-grade-good">{n.avg.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 border-t border-rule pt-3">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-data text-xs uppercase tracking-wide text-ink-soft">
            Manager commentary
          </h3>
          {!editing && (
            <button onClick={startEdit} className="text-xs font-medium text-navy hover:underline">
              Edit
            </button>
          )}
        </div>
        {editing ? (
          <div>
            <textarea
              className="w-full rounded border border-rule-strong bg-white p-2 text-sm outline-none focus:border-navy"
              rows={5}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write the division's biggest storylines here — who's trending up, who needs a check-in, what to watch next cycle…"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1 text-sm text-ink-soft hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded bg-navy px-3 py-1 text-sm font-medium text-white hover:bg-navy-soft disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-ink">
            {content || (
              <span className="text-ink-soft italic">
                No commentary yet — add the storylines the numbers don&apos;t capture.
              </span>
            )}
          </p>
        )}
        {meta.updated_by && (
          <p className="mt-1 font-data text-[11px] text-ink-soft">
            Last updated by {meta.updated_by}
            {meta.updated_at ? ` on ${new Date(meta.updated_at).toLocaleDateString()}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
