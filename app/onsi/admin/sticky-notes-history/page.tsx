"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { STICKY_COLOR_HEX, StickyColor } from "@/lib/stickyNotes";

type HistoryNote = {
  id: number;
  subject_type: string;
  subject_id: string;
  field_label: string | null;
  color: StickyColor;
  body: string;
  created_by: string | null;
  created_at: string;
  deleted_by: string | null;
  deleted_at: string | null;
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function StickyNoteHistoryPage() {
  const [notes, setNotes] = useState<HistoryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/sticky-notes/history")
      .then((r) => r.json())
      .then((d) => setNotes(d.notes ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function restore(id: number) {
    setBusyId(id);
    await fetch(`/api/sticky-notes/${id}/restore`, { method: "POST" });
    setBusyId(null);
    load();
  }

  async function deleteNote(id: number) {
    setBusyId(id);
    await fetch(`/api/sticky-notes/${id}`, { method: "DELETE" });
    setBusyId(null);
    load();
  }

  async function removeFromHistory(id: number) {
    if (!window.confirm("Permanently remove this from history? This can't be undone.")) return;
    setBusyId(id);
    await fetch(`/api/sticky-notes/${id}?permanent=true`, { method: "DELETE" });
    setBusyId(null);
    load();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/onsi/admin" className="text-xs font-medium text-ink-soft hover:text-navy">
        ← Admin
      </Link>
      <p className="mt-2 font-data text-xs uppercase tracking-widest text-ink-soft">Admin</p>
      <h1 className="font-display text-2xl font-bold text-navy">Sticky Note History</h1>
      <p className="mt-2 text-sm text-ink-soft">
        The most recent 200 sticky notes across the whole app, active and removed. Anyone
        can remove a note whether they wrote it or not, so this is here in case something
        gets cleared that shouldn&apos;t have — restoring puts it right back where it was.
        Removing from history is permanent and can&apos;t be undone.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-ink-soft">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="mt-6 text-sm italic text-ink-soft">No sticky notes yet.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="card flex items-start gap-3 rounded-md p-3"
              style={{ opacity: n.deleted_at ? 0.6 : 1 }}
            >
              <span
                className="mt-1 h-4 w-4 shrink-0 rounded-sm"
                style={{ backgroundColor: STICKY_COLOR_HEX[n.color] ?? "#fdf1a8" }}
              />
              <div className="min-w-0 flex-1">
                <p
                  className="text-sm text-ink"
                  style={{ textDecoration: n.deleted_at ? "line-through" : "none" }}
                >
                  {n.body}
                </p>
                <p className="mt-1 font-data text-[11px] text-ink-soft">
                  {n.subject_type} #{n.subject_id}
                  {n.field_label ? ` — ${n.field_label}` : ""} · {n.created_by ?? "Unknown"},{" "}
                  {formatWhen(n.created_at)}
                  {n.deleted_at && (
                    <>
                      {" "}
                      · removed by {n.deleted_by ?? "Unknown"}, {formatWhen(n.deleted_at)}
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {n.deleted_at ? (
                  <>
                    <button
                      onClick={() => restore(n.id)}
                      disabled={busyId === n.id}
                      className="rounded border border-navy px-2.5 py-1 text-xs font-medium text-navy hover:bg-navy hover:text-white disabled:opacity-60"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => removeFromHistory(n.id)}
                      disabled={busyId === n.id}
                      className="rounded border border-grease-red px-2.5 py-1 text-xs font-medium text-grease-red hover:bg-grease-red hover:text-white disabled:opacity-60"
                    >
                      Remove from history
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => deleteNote(n.id)}
                    disabled={busyId === n.id}
                    className="rounded border border-grease-red px-2.5 py-1 text-xs font-medium text-grease-red hover:bg-grease-red hover:text-white disabled:opacity-60"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
