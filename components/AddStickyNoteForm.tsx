"use client";

import { useState } from "react";
import { STICKY_COLORS, StickyColor, STICKY_COLOR_HEX } from "@/lib/stickyNotes";
import { trailingMentionQuery, applyMention } from "@/lib/mentions";
import { MentionDropdown, useKnownNames } from "./MentionDropdown";

export function AddStickyNoteForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (body: string, color: StickyColor) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [color, setColor] = useState<StickyColor>("yellow");
  const [busy, setBusy] = useState(false);
  const knownNames = useKnownNames();
  const mentionQuery = trailingMentionQuery(text);

  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    const ok = await onSubmit(text.trim(), color);
    setBusy(false);
    if (ok) onCancel();
  }

  return (
    <div
      className="card rounded-md p-3"
      style={{ width: 220 }}
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Quick note…"
        rows={3}
        className="w-full resize-none rounded border border-rule-strong bg-white p-2 text-sm outline-none focus:border-navy"
      />
      {mentionQuery !== null && (
        <MentionDropdown
          query={mentionQuery}
          names={knownNames}
          onPick={(name) => setText((t) => applyMention(t, name))}
        />
      )}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex gap-1.5">
          {STICKY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`${c} note`}
              className="h-5 w-5 rounded-full"
              style={{
                backgroundColor: STICKY_COLOR_HEX[c],
                outline: color === c ? "2px solid var(--navy)" : "1px solid var(--rule-strong)",
                outlineOffset: 1,
              }}
            />
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-2 py-1 text-xs text-ink-soft hover:text-navy"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !text.trim()}
            className="rounded bg-navy px-2.5 py-1 text-xs font-medium text-white hover:bg-navy-soft disabled:opacity-60"
          >
            Pin it
          </button>
        </div>
      </div>
    </div>
  );
}
