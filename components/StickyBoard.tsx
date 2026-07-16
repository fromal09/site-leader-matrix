"use client";

import { useRef, useState } from "react";
import { StickyNoteRecord, StickyColor, STICKY_COLORS, STICKY_COLOR_HEX } from "@/lib/stickyNotes";

function clamp(n: number, min = 0, max = 92) {
  return Math.min(max, Math.max(min, n));
}

function ComposeSticky({
  x,
  y,
  onSubmit,
  onCancel,
}: {
  x: number;
  y: number;
  onSubmit: (body: string, color: StickyColor) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [color, setColor] = useState<StickyColor>("yellow");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!text.trim()) {
      onCancel();
      return;
    }
    setBusy(true);
    const ok = await onSubmit(text.trim(), color);
    setBusy(false);
    if (!ok) onCancel();
  }

  return (
    <div
      className={`sticky-note sticky-note--${color} sticky-note-compose`}
      style={{ left: `${x}%`, top: `${y}%` }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Quick note…"
        rows={3}
        className="sticky-note-textarea"
      />
      <div className="mt-1.5 flex items-center gap-1.5">
        {STICKY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setColor(c)}
            aria-label={`${c} note`}
            className="h-4 w-4 rounded-full"
            style={{
              backgroundColor: STICKY_COLOR_HEX[c],
              outline: color === c ? "2px solid rgba(0,0,0,0.4)" : "1px solid rgba(0,0,0,0.15)",
              outlineOffset: 1,
            }}
          />
        ))}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={submit}
          disabled={busy}
          className="ml-auto font-data text-[10px] uppercase tracking-wide text-ink"
          style={{ opacity: 0.65 }}
        >
          Pin
        </button>
      </div>
    </div>
  );
}

// Deterministic fallback for legacy notes that predate free positioning.
function fallbackPos(id: number) {
  const slots = [
    { x: 4, y: 4 },
    { x: 60, y: 8 },
    { x: 30, y: 55 },
    { x: 70, y: 50 },
  ];
  return slots[id % slots.length];
}

export function StickyBoard({
  notes,
  onAdd,
  onRemove,
  onUpdatePosition,
  children,
}: {
  notes: StickyNoteRecord[];
  onAdd: (body: string, color: StickyColor, posX: number, posY: number) => Promise<boolean>;
  onRemove: (id: number) => void;
  onUpdatePosition: (id: number, posX: number, posY: number) => void;
  children: React.ReactNode;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [composeAt, setComposeAt] = useState<{ x: number; y: number } | null>(null);
  const [dragState, setDragState] = useState<{ id: number; x: number; y: number } | null>(null);

  function handleDoubleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest(".sticky-note")) return;
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100);
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100);
    setComposeAt({ x, y });
  }

  function startDrag(note: StickyNoteRecord, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();

    function onMove(ev: PointerEvent) {
      const x = clamp(((ev.clientX - rect.left) / rect.width) * 100);
      const y = clamp(((ev.clientY - rect.top) / rect.height) * 100);
      setDragState({ id: note.id, x, y });
    }
    function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const x = clamp(((ev.clientX - rect.left) / rect.width) * 100);
      const y = clamp(((ev.clientY - rect.top) / rect.height) * 100);
      onUpdatePosition(note.id, x, y);
      setDragState(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div ref={boardRef} className="relative" onDoubleClick={handleDoubleClick}>
      {children}

      {notes.map((note) => {
        const dragging = dragState?.id === note.id;
        const fallback = fallbackPos(note.id);
        const x = dragging ? dragState!.x : (note.pos_x ?? fallback.x);
        const y = dragging ? dragState!.y : (note.pos_y ?? fallback.y);
        return (
          <div
            key={note.id}
            className={`sticky-note sticky-note--${note.color}`}
            style={{ left: `${x}%`, top: `${y}%`, cursor: dragging ? "grabbing" : "grab" }}
            onPointerDown={(e) => startDrag(note, e)}
          >
            <button
              className="sticky-note-delete"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(note.id);
              }}
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

      {composeAt && (
        <ComposeSticky
          x={composeAt.x}
          y={composeAt.y}
          onSubmit={(body, color) => onAdd(body, color, composeAt.x, composeAt.y)}
          onCancel={() => setComposeAt(null)}
        />
      )}
    </div>
  );
}
