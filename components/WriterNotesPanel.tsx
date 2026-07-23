"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import type { WriterNote } from "@/lib/depthCharts";

export function WriterNotesPanel({ writerId, apiPrefix = "" }: { writerId: number; apiPrefix?: string }) {
  const { requireAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<WriterNote[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`${apiPrefix}/api/depth-chart-writers/card/${writerId}/notes`);
    const d = await res.json();
    setNotes(d.notes ?? []);
    setLoading(false);
  }

  async function toggle() {
    if (!open && notes === null) await load();
    setOpen((o) => !o);
  }

  async function submit() {
    if (!requireAuth()) return;
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`${apiPrefix}/api/depth-chart-writers/card/${writerId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Couldn't save the note.");
      return;
    }
    setDraft("");
    load();
  }

  async function remove(noteId: number) {
    if (!requireAuth()) return;
    if (!window.confirm("Delete this note? This can't be undone.")) return;
    await fetch(`${apiPrefix}/api/depth-chart-writers/card/${writerId}/notes/${noteId}`, {
      method: "DELETE",
    });
    load();
  }

  return (
    <div className="mt-2 border-t border-rule pt-2">
      <button
        type="button"
        onClick={toggle}
        className="font-data text-xs font-medium uppercase tracking-wide text-ink-soft hover:text-navy"
      >
        {open ? "Hide notes ▲" : `Notes${notes ? ` (${notes.length})` : ""} ▾`}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <textarea
              className="flex-1 rounded border border-rule-strong bg-white p-2 text-xs outline-none focus:border-navy"
              rows={2}
              placeholder="Add a note about this writer…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button
              onClick={submit}
              disabled={busy || !draft.trim()}
              className="self-start rounded bg-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-soft disabled:opacity-60"
            >
              {busy ? "Saving…" : "Add"}
            </button>
          </div>
          {error && <p className="text-xs text-grade-low">{error}</p>}

          {loading ? (
            <p className="text-xs text-ink-soft">Loading…</p>
          ) : notes && notes.length > 0 ? (
            <ul className="space-y-1.5">
              {notes.map((n) => (
                <li key={n.id} className="rounded border border-rule bg-white p-2 text-xs">
                  <p className="whitespace-pre-wrap text-ink">{n.content}</p>
                  <div className="mt-1 flex items-center justify-between font-data text-[10px] text-ink-soft">
                    <span>
                      {n.created_by ?? "unknown"} ·{" "}
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => remove(n.id)}
                      className="text-grease-red hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs italic text-ink-soft">No notes yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
