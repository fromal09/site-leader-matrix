"use client";

import { useEffect, useState } from "react";
import { categoryLabel } from "@/lib/categories";
import type { HistoryRow } from "@/lib/types";

export function HistoryLog({ siteId, refreshKey }: { siteId: number; refreshKey: number }) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/history/${siteId}`)
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []))
      .finally(() => setLoading(false));
  }, [siteId, refreshKey]);

  if (loading) return null;
  if (history.length === 0) {
    return (
      <p className="text-sm italic text-ink-soft">
        No tracked history yet — this site is still on placeholder scores. Canonize it to
        start tracking progression and regression over time.
      </p>
    );
  }

  return (
    <ul className="space-y-2 font-data text-xs">
      {history.map((h, i) => (
        <li key={i} className="flex items-baseline justify-between border-b border-rule pb-1">
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
            {categoryLabel(h.category)} → <strong>{h.score}</strong>
            {h.note ? ` — "${h.note}"` : ""}
          </span>
          <span className="whitespace-nowrap text-ink-soft">
            {h.changed_by ?? "unknown"} · {new Date(h.changed_at).toLocaleDateString()}
          </span>
        </li>
      ))}
    </ul>
  );
}
