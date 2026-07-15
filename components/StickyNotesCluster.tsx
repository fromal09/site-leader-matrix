"use client";

import { useState } from "react";
import { StickyNoteRecord, StickyColor } from "@/lib/stickyNotes";
import { AddStickyNoteForm } from "./AddStickyNoteForm";

// Deterministic scatter slots so notes don't jump around on re-render.
const SLOTS = [
  { top: "-46px", left: "-10px", transform: "rotate(-4deg)" },
  { top: "-30px", right: "30px", transform: "rotate(5deg)" },
  { bottom: "-54px", left: "60px", transform: "rotate(-2deg)" },
  { top: "40%", right: "-24px", transform: "rotate(3deg)" },
  { bottom: "-40px", right: "20%", transform: "rotate(-5deg)" },
  { top: "10%", left: "-28px", transform: "rotate(4deg)" },
];

function slotFor(id: number) {
  return SLOTS[id % SLOTS.length];
}

export function StickyNotesCluster({
  notes,
  onAdd,
  onRemove,
  addButtonPosition = "bottom-left",
}: {
  subjectId?: string | number;
  notes: StickyNoteRecord[];
  onAdd: (body: string, color: StickyColor) => Promise<boolean>;
  onRemove: (id: number) => void;
  addButtonPosition?: "bottom-left" | "bottom-right" | "top-right";
}) {
  const [adding, setAdding] = useState(false);

  const posStyle: React.CSSProperties =
    addButtonPosition === "bottom-right"
      ? { position: "absolute", bottom: -34, right: 0, zIndex: 22 }
      : addButtonPosition === "top-right"
        ? { position: "absolute", top: -12, right: -8, zIndex: 22 }
        : { position: "absolute", bottom: -34, left: 0, zIndex: 22 };

  return (
    <>
      {notes.map((note) => {
        const slot = slotFor(note.id);
        return (
          <div
            key={note.id}
            className={`sticky-note sticky-note--${note.color}`}
            style={slot as React.CSSProperties}
          >
            <button
              className="sticky-note-delete"
              onClick={() => onRemove(note.id)}
              aria-label="Remove note"
            >
              ×
            </button>
            {note.field_label && <div className="sticky-note-field-tag">Re: {note.field_label}</div>}
            {note.body}
            <div className="sticky-note-meta">
              — {note.created_by ?? "Unknown"},{" "}
              {new Date(note.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
        );
      })}

      <div style={posStyle}>
        {adding ? (
          <AddStickyNoteForm onSubmit={onAdd} onCancel={() => setAdding(false)} />
        ) : (
          <button type="button" className="pin-note-btn" onClick={() => setAdding(true)}>
            + pin a note
          </button>
        )}
      </div>
    </>
  );
}
