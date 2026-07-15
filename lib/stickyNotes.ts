"use client";

import { useEffect, useState, useCallback } from "react";

export const STICKY_COLORS = ["yellow", "pink", "blue", "green"] as const;
export type StickyColor = (typeof STICKY_COLORS)[number];

export const STICKY_COLOR_HEX: Record<StickyColor, string> = {
  yellow: "#fdf1a8",
  pink: "#fbd0dc",
  blue: "#c9e4f7",
  green: "#d7ecc7",
};

export type StickyNoteRecord = {
  id: number;
  subject_type: string;
  subject_id: string;
  field_label: string | null;
  color: StickyColor;
  body: string;
  created_by: string | null;
  created_at: string;
};

// Batched fetch: one request covers every subject a page needs (e.g. every
// writer on a roster, every division card on the home page), instead of
// each individual sticky-notes cluster firing its own request.
export function useStickyNotes(subjectType: string, subjectIds: (string | number)[]) {
  const [notes, setNotes] = useState<StickyNoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const idsKey = subjectIds.map(String).join(",");

  const load = useCallback(() => {
    if (!idsKey) {
      setNotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/sticky-notes?subjectType=${subjectType}&subjectIds=${encodeURIComponent(idsKey)}`)
      .then((r) => r.json())
      .then((d) => setNotes(d.notes ?? []))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectType, idsKey]);

  useEffect(() => {
    load();
  }, [load]);

  function notesFor(subjectId: string | number, fieldLabel: string | null = null) {
    const sid = String(subjectId);
    return notes.filter((n) => n.subject_id === sid && n.field_label === fieldLabel);
  }

  function allNotesFor(subjectId: string | number) {
    const sid = String(subjectId);
    return notes.filter((n) => n.subject_id === sid);
  }

  async function addNote(
    subjectId: string | number,
    body: string,
    color: StickyColor,
    fieldLabel: string | null = null
  ) {
    const res = await fetch("/api/sticky-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectType, subjectId: String(subjectId), fieldLabel, color, body }),
    });
    if (res.ok) load();
    return res.ok;
  }

  async function removeNote(id: number) {
    await fetch(`/api/sticky-notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return { notes, loading, notesFor, allNotesFor, addNote, removeNote, refetch: load };
}
