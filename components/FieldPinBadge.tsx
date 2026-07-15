"use client";

import { useState } from "react";
import { StickyNoteRecord, StickyColor } from "@/lib/stickyNotes";
import { AddStickyNoteForm } from "./AddStickyNoteForm";

export function FieldPinBadge({
  notes,
  onAdd,
}: {
  notes: StickyNoteRecord[];
  onAdd: (body: string, color: StickyColor) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "absolute", top: -9, right: -9, zIndex: 21 }}>
      {notes.length > 0 ? (
        <button
          type="button"
          className="sticky-pin-badge"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          aria-label={`${notes.length} note${notes.length === 1 ? "" : "s"} on this field`}
        >
          {notes.length}
        </button>
      ) : (
        <button
          type="button"
          className="sticky-pin-badge sticky-pin-badge--ghost"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          aria-label="Pin a note on this field"
        >
          +
        </button>
      )}
      {open && (
        <div style={{ position: "absolute", top: 22, right: 0, zIndex: 22 }}>
          {notes.length > 0 && (
            <div className="mb-1.5 space-y-1.5">
              {notes.map((n) => (
                <div
                  key={n.id}
                  className={`sticky-note sticky-note--${n.color}`}
                  style={{ position: "static" }}
                >
                  {n.body}
                  <div className="sticky-note-meta">
                    — {n.created_by ?? "Unknown"},{" "}
                    {new Date(n.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <AddStickyNoteForm onSubmit={onAdd} onCancel={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
