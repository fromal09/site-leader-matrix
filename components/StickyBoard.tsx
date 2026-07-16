"use client";

import { useEffect, useRef, useState } from "react";
import {
  StickyNoteRecord,
  StickyNoteReply,
  StickyColor,
  STICKY_COLORS,
  STICKY_COLOR_HEX,
} from "@/lib/stickyNotes";

function clamp(n: number, min = 0, max = 92) {
  return Math.min(max, Math.max(min, n));
}

// Distance a pointer can move between down/up and still count as a click
// (opening the reply thread) rather than a drag.
const DRAG_THRESHOLD_PX = 4;

function ComposeSticky({
  x,
  y,
  onSubmit,
  onCancel,
}: {
  x: number;
  y: number;
  onSubmit: (body: string, color: StickyColor) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [color, setColor] = useState<StickyColor>("yellow");

  function submit() {
    if (!text.trim()) {
      onCancel();
      return;
    }
    // Close immediately — the note this becomes shows up right away via
    // the optimistic update, so there's no in-between "ghost" state.
    onCancel();
    onSubmit(text.trim(), color);
  }

  return (
    <div
      className="sticky-note sticky-note--yellow sticky-note-compose"
      style={{ left: `${x}%`, top: `${y}%`, backgroundColor: STICKY_COLOR_HEX[color] }}
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
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
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
          className="ml-auto font-data text-[10px] uppercase tracking-wide text-ink"
          style={{ opacity: 0.65 }}
        >
          Pin
        </button>
      </div>
    </div>
  );
}

function ReplyThread({
  noteId,
  onCountChange,
}: {
  noteId: number;
  onCountChange: (delta: number) => void;
}) {
  const [replies, setReplies] = useState<StickyNoteReply[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/sticky-notes/${noteId}/replies`)
      .then((r) => r.json())
      .then((d) => setReplies(d.replies ?? []));
  }, [noteId]);

  async function send() {
    if (!draft.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/sticky-notes/${noteId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json();
      setReplies((prev) => [...(prev ?? []), data.reply]);
      onCountChange(1);
      setDraft("");
    }
  }

  async function remove(replyId: number) {
    setReplies((prev) => (prev ?? []).filter((r) => r.id !== replyId));
    onCountChange(-1);
    await fetch(`/api/sticky-notes/${noteId}/replies/${replyId}`, { method: "DELETE" });
  }

  return (
    <div
      className="sticky-note-thread"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {replies === null ? (
        <p className="sticky-note-thread-loading">Loading…</p>
      ) : (
        replies.map((r) => (
          <div key={r.id} className="sticky-note-reply">
            <span>{r.body}</span>
            <button
              className="sticky-note-reply-delete"
              onClick={() => remove(r.id)}
              aria-label="Delete reply"
            >
              ×
            </button>
            <div className="sticky-note-reply-meta">— {r.created_by ?? "Unknown"}</div>
          </div>
        ))
      )}
      <div className="sticky-note-reply-input">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Reply…"
          disabled={busy}
        />
        <button onClick={send} disabled={busy || !draft.trim()} aria-label="Send reply">
          ↵
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
  return slots[Math.abs(id) % slots.length];
}

export function StickyBoard({
  notes,
  onAdd,
  onRemove,
  onUpdatePosition,
  onBumpReplyCount,
  children,
}: {
  notes: StickyNoteRecord[];
  onAdd: (body: string, color: StickyColor, posX: number, posY: number) => void;
  onRemove: (id: number) => void;
  onUpdatePosition: (id: number, posX: number, posY: number) => void;
  onBumpReplyCount?: (id: number, delta: number) => void;
  children: React.ReactNode;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [composeAt, setComposeAt] = useState<{ x: number; y: number } | null>(null);
  const [dragState, setDragState] = useState<{ id: number; x: number; y: number } | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;

    function onMove(ev: PointerEvent) {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > DRAG_THRESHOLD_PX) {
        moved = true;
      }
      if (!moved) return;
      const x = clamp(((ev.clientX - rect.left) / rect.width) * 100);
      const y = clamp(((ev.clientY - rect.top) / rect.height) * 100);
      setDragState({ id: note.id, x, y });
    }
    function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (moved) {
        const x = clamp(((ev.clientX - rect.left) / rect.width) * 100);
        const y = clamp(((ev.clientY - rect.top) / rect.height) * 100);
        onUpdatePosition(note.id, x, y);
      } else {
        setExpandedId((prev) => (prev === note.id ? null : note.id));
      }
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
        const expanded = expandedId === note.id;
        return (
          <div
            key={note.id}
            className={`sticky-note sticky-note--${note.color}${expanded ? " sticky-note-expanded" : ""}`}
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
            <button
              className="sticky-note-reply-toggle"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setExpandedId((prev) => (prev === note.id ? null : note.id));
              }}
            >
              💬 Reply{note.reply_count > 0 ? ` (${note.reply_count})` : ""}
            </button>
            {expanded && (
              <ReplyThread
                noteId={note.id}
                onCountChange={(delta) => onBumpReplyCount?.(note.id, delta)}
              />
            )}
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
