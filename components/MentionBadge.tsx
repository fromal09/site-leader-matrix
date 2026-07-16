"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Mention = {
  id: number;
  mentioned_name: string;
  created_by: string | null;
  created_at: string;
  subject_type: string | null;
  subject_id: string | null;
  excerpt: string | null;
};

export function MentionBadge({ name }: { name: string }) {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function load() {
    fetch(`/api/mentions?name=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((d) => setMentions(d.mentions ?? []));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  async function markAllRead() {
    await fetch("/api/mentions/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setMentions([]);
    setOpen(false);
  }

  async function openMention(m: Mention) {
    await fetch("/api/mentions/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mentionId: m.id }),
    });
    setMentions((prev) => prev.filter((x) => x.id !== m.id));
    setOpen(false);
    if (m.subject_type === "page" && m.subject_id) {
      router.push(m.subject_id);
    }
  }

  if (mentions.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full bg-grease-red px-1.5 py-0.5 text-[10px] font-bold text-white"
        aria-label={`${mentions.length} unread mention${mentions.length === 1 ? "" : "s"}`}
      >
        @ {mentions.length}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-md border border-rule-strong bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-rule px-3 py-2">
            <span className="font-data text-[10px] uppercase tracking-wide text-ink-soft">
              Mentions
            </span>
            <button
              onClick={markAllRead}
              className="font-data text-[10px] text-navy hover:underline"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto scroll-thin">
            {mentions.map((m) => (
              <button
                key={m.id}
                onClick={() => openMention(m)}
                className="block w-full border-b border-rule px-3 py-2 text-left last:border-b-0 hover:bg-paper"
              >
                <p className="line-clamp-2 text-xs text-ink">{m.excerpt}</p>
                <p className="mt-1 font-data text-[10px] text-ink-soft">
                  {m.created_by ?? "Unknown"} ·{" "}
                  {new Date(m.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
