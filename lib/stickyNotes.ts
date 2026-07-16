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
  pos_x: number | null;
  pos_y: number | null;
  created_by: string | null;
  created_at: string;
  reply_count: number;
};

export type StickyNoteReply = {
  id: number;
  note_id: number;
  body: string;
  created_by: string | null;
  created_at: string;
};

let tempIdCounter = -1;

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

  // Optimistic: the note appears — draggable, deletable, repliable — the
  // instant you hit Pin, using a temporary id until the server confirms and
  // hands back the real one. No waiting on a round trip to interact with it.
  async function addNote(
    subjectId: string | number,
    body: string,
    color: StickyColor,
    fieldLabel: string | null = null,
    posX: number | null = null,
    posY: number | null = null
  ) {
    const tempId = tempIdCounter--;
    const optimistic: StickyNoteRecord = {
      id: tempId,
      subject_type: subjectType,
      subject_id: String(subjectId),
      field_label: fieldLabel,
      color,
      body,
      pos_x: posX,
      pos_y: posY,
      created_by: null,
      created_at: new Date().toISOString(),
      reply_count: 0,
    };
    setNotes((prev) => [...prev, optimistic]);

    const res = await fetch("/api/sticky-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectType,
        subjectId: String(subjectId),
        fieldLabel,
        color,
        body,
        posX,
        posY,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setNotes((prev) => prev.map((n) => (n.id === tempId ? data.note : n)));
      return true;
    }
    // Failed — drop the optimistic note.
    setNotes((prev) => prev.filter((n) => n.id !== tempId));
    return false;
  }

  async function removeNote(id: number) {
    // Optimistic: gone from the board immediately, sync in the background.
    const prevNotes = notes;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (id < 0) return; // still-pending optimistic note, nothing to delete server-side yet
    const res = await fetch(`/api/sticky-notes/${id}`, { method: "DELETE" });
    if (!res.ok) setNotes(prevNotes); // roll back on failure
  }

  async function updatePosition(id: number, posX: number, posY: number) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, pos_x: posX, pos_y: posY } : n)));
    if (id < 0) return;
    await fetch(`/api/sticky-notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posX, posY }),
    });
  }

  function bumpReplyCount(id: number, delta: number) {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, reply_count: Math.max(0, n.reply_count + delta) } : n))
    );
  }

  return {
    notes,
    loading,
    notesFor,
    allNotesFor,
    addNote,
    removeNote,
    updatePosition,
    bumpReplyCount,
    refetch: load,
  };
}
