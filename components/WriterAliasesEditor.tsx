"use client";

import { useEffect, useState } from "react";

type Alias = { id: number; alias: string };

export function WriterAliasesEditor({ writerId }: { writerId: number }) {
  const [aliases, setAliases] = useState<Alias[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/depth-chart-writers/card/${writerId}/aliases`)
      .then((r) => r.json())
      .then((d) => setAliases(d.aliases ?? []));
  }, [writerId]);

  async function addAlias() {
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/depth-chart-writers/card/${writerId}/aliases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alias: draft.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Couldn't add alias.");
      return;
    }
    const data = await res.json();
    setAliases((prev) => {
      const next = prev ? [...prev] : [];
      if (!next.some((a) => a.id === data.alias.id)) next.push(data.alias);
      return next.sort((a, b) => a.alias.localeCompare(b.alias));
    });
    setDraft("");
  }

  async function removeAlias(aliasId: number) {
    setBusy(true);
    await fetch(`/api/depth-chart-writers/card/${writerId}/aliases/${aliasId}`, {
      method: "DELETE",
    });
    setBusy(false);
    setAliases((prev) => (prev ? prev.filter((a) => a.id !== aliasId) : prev));
  }

  return (
    <div>
      <label className="text-xs font-medium text-ink-soft uppercase tracking-wide">
        Other bylines{" "}
        <span className="normal-case text-ink-soft">
          (extra names this writer publishes under, e.g. shorthand or old bylines)
        </span>
      </label>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {(aliases ?? []).map((a) => (
          <span
            key={a.id}
            className="flex items-center gap-1 rounded-full border border-rule-strong bg-white px-2 py-0.5 text-xs"
          >
            {a.alias}
            <button
              type="button"
              onClick={() => removeAlias(a.id)}
              disabled={busy}
              className="text-ink-soft hover:text-grease-red"
              aria-label={`Remove alias ${a.alias}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        <input
          className="flex-1 rounded border border-rule-strong bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
          placeholder="Add another byline…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addAlias();
            }
          }}
        />
        <button
          type="button"
          onClick={addAlias}
          disabled={busy || !draft.trim()}
          className="rounded bg-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-soft disabled:opacity-60"
        >
          Add
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-grade-low">{error}</p>}
    </div>
  );
}
