"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function AdminPage() {
  const { requireAuth } = useAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedStatement, setFailedStatement] = useState<string | null>(null);

  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveResult, setArchiveResult] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  async function runMigrations() {
    if (!requireAuth()) return;
    setBusy(true);
    setResult(null);
    setError(null);
    setFailedStatement(null);
    const res = await fetch("/api/admin/migrate", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(
        `${data.error ?? "Migration failed."} (ran ${data.ranStatements}/${data.totalStatements} statements)`
      );
      setFailedStatement(data.failedStatement ?? null);
      return;
    }
    setResult(`Ran ${data.ranStatements}/${data.totalStatements} schema statement(s) successfully.`);
  }

  async function archiveOldTraffic() {
    if (!requireAuth()) return;
    const year = new Date().getFullYear();
    const confirmed = window.confirm(
      `This permanently deletes individual article rows for any month before January ${year}. ` +
        `Site-level and writer-level monthly totals are saved first and will keep working in the ` +
        `trend charts — you just won't be able to drill into specific old articles anymore. Continue?`
    );
    if (!confirmed) return;
    setArchiveBusy(true);
    setArchiveResult(null);
    setArchiveError(null);
    const res = await fetch("/api/admin/archive-old-traffic", { method: "POST" });
    const data = await res.json();
    setArchiveBusy(false);
    if (!res.ok) {
      setArchiveError(data.error ?? "Archiving failed.");
      return;
    }
    setArchiveResult(
      data.importsArchived === 0
        ? "Nothing to archive — no imports older than this year."
        : `Archived ${data.importsArchived} month(s) of data, freeing ${data.rowsFreed.toLocaleString()} article rows.`
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="font-data text-xs uppercase tracking-widest text-ink-soft">Admin</p>
      <h1 className="font-display text-2xl font-bold text-navy">Database Migrations</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Applies the current schema (new tables, columns, seed rows) to the live database.
        Safe to run anytime — every statement is idempotent and won&apos;t touch existing
        data. Run this after any deploy that adds a new table or seed data.
      </p>
      <button
        onClick={runMigrations}
        disabled={busy}
        className="mt-4 rounded bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-soft disabled:opacity-60"
      >
        {busy ? "Running…" : "Run Database Migrations"}
      </button>
      {result && <p className="mt-3 text-sm text-grade-good">{result}</p>}
      {error && <p className="mt-3 text-sm text-grade-low">{error}</p>}
      {failedStatement && (
        <pre className="mt-2 overflow-x-auto rounded border border-rule-strong bg-white p-3 font-data text-xs text-ink">
          {failedStatement}
        </pre>
      )}

      <h2 className="mt-10 font-display text-2xl font-bold text-navy">
        Archive Prior-Year Traffic Detail
      </h2>
      <p className="mt-2 text-sm text-ink-soft">
        Rolls up individual article rows from before the current year into permanent
        site-level and writer-level monthly totals, then deletes the detail rows to free
        database storage. Trend charts keep working for archived months — only the
        per-article drill-down (top articles, full article list, homepage page list) goes
        away for those old months. Current-year data is never touched.
      </p>
      <button
        onClick={archiveOldTraffic}
        disabled={archiveBusy}
        className="mt-4 rounded border-2 border-grease-red px-4 py-2 text-sm font-semibold uppercase tracking-wide text-grease-red hover:bg-grease-red hover:text-white disabled:opacity-60"
      >
        {archiveBusy ? "Archiving…" : "Archive Prior-Year Traffic"}
      </button>
      {archiveResult && <p className="mt-3 text-sm text-grade-good">{archiveResult}</p>}
      {archiveError && <p className="mt-3 text-sm text-grade-low">{archiveError}</p>}
    </main>
  );
}
