"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";

export function ChangeLeaderForm({
  siteId,
  currentLeader,
  onChanged,
}: {
  siteId: number;
  currentLeader: string;
  onChanged: () => void;
}) {
  const { requireAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function start() {
    if (!requireAuth()) return;
    setName("");
    setError(null);
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const confirmed = window.confirm(
      `Replace ${currentLeader} with ${name.trim()} as site leader? All four quadrant scores will be marked as placeholders pending fresh evaluation and canonization.`
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    const res = await fetch(`/api/sites/${siteId}/change-leader`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newLeader: name.trim() }),
    });
    setBusy(false);

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Something went wrong.");
      return;
    }
    setOpen(false);
    onChanged();
  }

  return (
    <div className="card rounded-md p-4">
      <h2 className="font-display text-lg font-semibold text-navy">Site Leadership</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Current leader: <strong className="text-ink">{currentLeader}</strong>
      </p>

      {!open ? (
        <button
          onClick={start}
          className="mt-3 rounded border border-navy px-3 py-1.5 text-xs font-medium text-navy hover:bg-navy hover:text-white"
        >
          Change site leader
        </button>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <input
            autoFocus
            className="w-full rounded border border-rule-strong bg-white px-3 py-2 text-sm outline-none focus:border-navy"
            placeholder="New site leader's name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          {error && <p className="text-sm text-grade-low">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1 text-sm text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-grease-red px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Submitting…" : "Submit new leader"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
