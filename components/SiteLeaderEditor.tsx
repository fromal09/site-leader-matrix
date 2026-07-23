"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";

export function SiteLeaderEditor({
  siteId,
  leaderName,
  onChanged,
  apiPrefix = "",
}: {
  siteId: number;
  leaderName: string;
  onChanged: (newName: string) => void;
  apiPrefix?: string;
}) {
  const { requireAuth } = useAuth();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(leaderName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function start() {
    if (!requireAuth()) return;
    setValue(leaderName);
    setError(null);
    setEditing(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || value.trim() === leaderName) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api${apiPrefix}/sites/${siteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaderName: value.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Couldn't save.");
      return;
    }
    setEditing(false);
    onChanged(value.trim());
  }

  if (!editing) {
    return (
      <span className="text-sm text-ink-soft">
        Site leader: <strong className="text-ink">{leaderName}</strong>{" "}
        <button onClick={start} className="text-xs font-medium text-navy hover:underline">
          (edit)
        </button>
      </span>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <span className="text-sm text-ink-soft">Site leader:</span>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded border border-rule-strong bg-white px-2 py-1 text-sm outline-none focus:border-navy"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-navy px-2.5 py-1 text-xs font-medium text-white hover:bg-navy-soft disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs font-medium text-ink-soft hover:text-ink"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-grade-low">{error}</span>}
    </form>
  );
}
