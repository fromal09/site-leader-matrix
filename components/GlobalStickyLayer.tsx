"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useStickyNotes } from "@/lib/stickyNotes";
import { StickyBoard } from "./StickyBoard";

function GlobalStickyLayerInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  // Query params matter here — e.g. /site-leader-matrix?division=NFL and
  // ?division=NBA are the same path but should not share a corkboard.
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
