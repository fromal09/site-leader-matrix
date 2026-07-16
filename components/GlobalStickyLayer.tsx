"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useStickyNotes } from "@/lib/stickyNotes";
import { StickyBoard } from "./StickyBoard";

function GlobalStickyLayerInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const highlightNoteId = searchParams.get("highlightNote");

  // highlightNote is a one-time navigation signal, not part of what
  // identifies this page's corkboard — excluding it keeps the subject id
  // stable so it still matches the notes that already exist here.
  const boardParams = new URLSearchParams(searchParams);
  boardParams.delete("highlightNote");
  const qs = boardParams.toString();
  const subjectId = qs ? `${pathname}?${qs}` : pathname;

  const { notesFor, addNote, removeNote, updatePosition, bumpReplyCount } = useStickyNotes(
    "page",
    [subjectId]
  );

  return (
    <StickyBoard
      notes={notesFor(subjectId)}
      onAdd={(body, color, x, y) => addNote(subjectId, body, color, null, x, y)}
      onRemove={removeNote}
      onUpdatePosition={updatePosition}
      onBumpReplyCount={bumpReplyCount}
      highlightNoteId={highlightNoteId ? Number(highlightNoteId) : null}
    >
      {children}
    </StickyBoard>
  );
}

export function GlobalStickyLayer({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <GlobalStickyLayerInner>{children}</GlobalStickyLayerInner>
    </Suspense>
  );
}
