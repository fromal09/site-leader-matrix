"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function AdminPage() {
  const { requireAuth } = useAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedStatement, setFailedStatement] = useState<string | null>(null);

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
    </main>
  );
}
