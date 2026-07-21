"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function OnsiAdminPage() {
  const { requireAuth } = useAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runMigrations() {
    if (!requireAuth()) return;
    setBusy(true);
    setResult(null);
    setError(null);
    const res = await fetch("/api/admin/migrate", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(`${data.error ?? "Migration failed."} (ran ${data.ranStatements}/${data.totalStatements} statements)`);
      return;
    }
    setResult(`Ran ${data.ranStatements}/${data.totalStatements} statements successfully.`);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="font-data text-xs uppercase tracking-widest text-ink-soft">OnSI</p>
      <h1 className="font-display text-3xl font-bold text-navy">Admin</h1>

      <h2 className="mt-8 font-display text-xl font-bold text-navy">Database Migrations</h2>
      <p className="mt-2 text-sm text-ink-soft">
        Runs the shared schema — safe to run any time, creates only what's missing. This
        also covers FanSided's tables, since both networks share one database.
      </p>
      <button
        onClick={runMigrations}
        disabled={busy}
        className="mt-3 rounded bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-soft disabled:opacity-60"
      >
        {busy ? "Running…" : "Run Database Migrations"}
      </button>
      {result && <p className="mt-3 text-sm text-grade-good">{result}</p>}
      {error && <p className="mt-3 text-sm text-grade-low">{error}</p>}

      <h2 className="mt-10 font-display text-xl font-bold text-navy">Sticky Notes</h2>
      <p className="mt-2 text-sm text-ink-soft">
        Anyone can drag or clear any sticky note across the app. If something gets removed
        that shouldn&apos;t have been, the history page shows everything with a one-click undo.
      </p>
      <Link
        href="/onsi/admin/sticky-notes-history"
        className="mt-4 inline-block rounded border border-navy px-4 py-2 text-sm font-medium text-navy hover:bg-navy hover:text-white"
      >
        View Sticky Note History
      </Link>
    </main>
  );
}
