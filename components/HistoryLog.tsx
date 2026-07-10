"use client";

import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import type { HistoryRow } from "@/lib/types";

type LeaderChange = {
  old_leader: string;
  new_leader: string;
  changed_by: string | null;
  changed_at: string;
};

export function HistoryLog({ siteId, refreshKey }: { siteId: number; refreshKey: number }) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [leaderChanges, setLeaderChanges] = useState<LeaderChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/history/${siteId}`).then((r) => r.json()),
      fetch(`/api/leader-changes/${siteId}`).then((r) => r.json()),
    ])
      .then(([h, l]) => {
        setHistory(h.history ?? []);
        setLeaderChanges(l.changes ?? []);
      })
      .finally(() => setLoading(false));
  }, [siteId, refreshKey]);

  if (loading) return null;

  const grouped = CATEGORIES.map((c) => ({
    category: c,
    entries: history.filter((h) => h.category === c.key),
  }));
  const hasAnyHistory = history.length > 0;

  return (
    <div className="space-y-5">
      {leaderChanges.length > 0 && (
        <div>
          <h3 className="font-data text-xs uppercase tracking-wide text-ink-soft">
            Leadership timeline
          </h3>
          <ul className="mt-1 space-y-1 font-data text-xs">
            {leaderChanges.map((c, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between border-b border-rule pb-1"
              >
                <span>
                  <span className="mr-2 rounded bg-navy/10 px-1.5 py-0.5 text-[10px] uppercase text-navy">
                    leader change
                  </span>
                  {c.old_leader} → <strong>{c.new_leader}</strong>
                </span>
                <span className="whitespace-nowrap text-ink-soft">
                  {c.changed_by ?? "unknown"} · {new Date(c.changed_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasAnyHistory ? (
        <p className="text-sm italic text-ink-soft">
          No tracked score history yet — this site is still on placeholder scores. Canonize it
          to start tracking progression and regression over time.
        </p>
      ) : (
        grouped.map(({ category, entries }) => (
          <div key={category.key}>
            <h3 className="font-data text-xs uppercase tracking-wide text-ink-soft">
              {category.label}
            </h3>
            {entries.length === 0 ? (
              <p className="mt-1 text-xs italic text-ink-soft">Not canonized yet.</p>
            ) : (
              <ul className="mt-1 space-y-1 font-data text-xs">
                {entries.map((h, i) => (
                  <li
                    key={i}
                    className="flex items-baseline justify-between border-b border-rule pb-1"
                  >
                    <span>
                      <span
                        className={`mr-2 rounded px-1.5 py-0.5 text-[10px] uppercase ${
                          h.event_type === "canonized"
                            ? "bg-navy/10 text-navy"
                            : "bg-grease-red/10 text-grease-red"
                        }`}
                      >
                        {h.event_type}
                      </span>
                      <strong>{h.score}</strong>
                      {h.note ? ` — "${h.note}"` : ""}
                    </span>
                    <span className="whitespace-nowrap text-ink-soft">
                      {h.changed_by ?? "unknown"} · {new Date(h.changed_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))
      )}
    </div>
  );
}
