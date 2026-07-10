"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";

export function CanonizeButton({
  siteId,
  count,
  onDone,
  label,
}: {
  siteId?: number;
  count: number;
  onDone: () => void;
  label?: string;
}) {
  const { requireAuth } = useAuth();
  const [busy, setBusy] = useState(false);

  if (count === 0) return null;

  async function handleClick() {
    if (!requireAuth()) return;
    const confirmed = window.confirm(
      siteId
        ? "Lock in this site's current scores as the official baseline? Future edits will be tracked as history from this point."
        : `Lock in all ${count} placeholder score(s) across the division as the official baseline? Future edits will be tracked as history from this point.`
    );
    if (!confirmed) return;
    setBusy(true);
    await fetch("/api/canonize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(siteId ? { siteId } : {}),
    });
    setBusy(false);
    onDone();
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="rounded border-2 border-grease-red px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-grease-red hover:bg-grease-red hover:text-white disabled:opacity-60"
    >
      {busy ? "Canonizing…" : label ?? `Canonize ${count} placeholder score${count === 1 ? "" : "s"}`}
    </button>
  );
}
