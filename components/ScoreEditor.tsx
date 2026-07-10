"use client";

import { useState } from "react";
import { gradeBand, BAND_COLORS } from "@/lib/grades";
import { useAuth } from "./AuthProvider";
import type { ScoreRow } from "@/lib/types";
import type { CategoryKey } from "@/lib/categories";

export function ScoreEditor({
  siteId,
  category,
  label,
  row,
  onSaved,
}: {
  siteId: number;
  category: CategoryKey;
  label: string;
  row: ScoreRow | undefined;
  onSaved: () => void;
}) {
  const { requireAuth } = useAuth();
  const [editing, setEditing] = useState(false);
  const [score, setScore] = useState(Number(row?.score ?? 5));
  const [note, setNote] = useState(row?.note ?? "");
  const [saving, setSaving] = useState(false);

  const currentScore = Number(row?.score ?? 0);
  const band = gradeBand(currentScore);
  const color = BAND_COLORS[band];

  function startEdit() {
    if (!requireAuth()) return;
    setScore(row?.score ?? 5);
    setNote(row?.note ?? "");
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/scores/${siteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, score, note }),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      onSaved();
    }
  }

  return (
    <div className="card rounded-md p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-navy">
          {label}
        </h3>
        {!row?.is_canonized && (
          <span className="rounded-full bg-grease-red/10 px-2 py-0.5 text-[10px] font-medium text-grease-red">
            placeholder
          </span>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="flex-1"
            />
            <span className="font-data w-8 text-right text-lg font-semibold text-ink">
              {score}
            </span>
          </div>
          <textarea
            className="w-full rounded border border-rule-strong bg-white p-2 text-sm outline-none focus:border-navy"
            rows={3}
            placeholder="Notes on this grade…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              className="px-2 py-1 text-xs text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded bg-navy px-3 py-1 text-xs font-medium text-white hover:bg-navy-soft disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={startEdit} className="block w-full text-left">
          <div className="font-data text-3xl font-bold" style={{ color }}>
            {currentScore}
            <span className="text-base text-ink-soft">/10</span>
          </div>
          <p className="mt-1 min-h-[1.25rem] text-sm text-ink-soft">
            {row?.note || <span className="italic">No notes yet — click to add.</span>}
          </p>
        </button>
      )}
    </div>
  );
}
