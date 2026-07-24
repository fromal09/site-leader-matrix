"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

type PreviewResult = {
  wrongPeriod: string;
  correctPeriod: string;
  totalImports: number;
  conflictingSites: { siteId: number; siteName: string }[];
  siteSnapshotsToFix: number;
  writerSnapshotsToFix: number;
  siteDeltasToFix: number;
  writerDeltasToFix: number;
  siteArchiveConflicts: { siteId: number; siteName: string }[];
  writerArchiveRowsAtWrongPeriod: number;
};

type ApplyResult = {
  importsFixed: number;
  skippedSites: { siteId: number; siteName: string }[];
  siteSnapshotsFixed: number;
  writerSnapshotsFixed: number;
  siteDeltasFixed: number;
  writerDeltasFixed: number;
  siteArchiveFixed: number;
  archiveSkippedSites: { siteId: number; siteName: string }[];
  writerArchiveFixed: number;
};

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function OnsiAdminPage() {
  const { requireAuth } = useAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [wrongPeriod, setWrongPeriod] = useState("");
  const [correctPeriod, setCorrectPeriod] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  async function runPreview() {
    if (!requireAuth()) return;
    if (!wrongPeriod || !correctPeriod) return;
    setPreviewing(true);
    setPreview(null);
    setPreviewError(null);
    setApplyResult(null);
    setApplyError(null);
    const res = await fetch(
      `/api/onsi/admin/period-fix-preview?wrongPeriod=${wrongPeriod}&correctPeriod=${correctPeriod}`
    );
    const data = await res.json();
    setPreviewing(false);
    if (!res.ok) {
      setPreviewError(data.error ?? "Preview failed.");
      return;
    }
    setPreview(data);
  }

  async function applyFix() {
    if (!requireAuth()) return;
    if (!preview) return;
    if (!window.confirm(`Relabel ${preview.totalImports} import(s) from ${monthLabel(wrongPeriod)} to ${monthLabel(correctPeriod)}? This can't be undone.`)) {
      return;
    }
    setApplying(true);
    setApplyResult(null);
    setApplyError(null);
    const res = await fetch("/api/onsi/admin/period-fix-apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wrongPeriod, correctPeriod, correctLabel: monthLabel(correctPeriod) }),
    });
    const data = await res.json();
    setApplying(false);
    if (!res.ok) {
      setApplyError(data.error ?? "Fix failed.");
      return;
    }
    setApplyResult(data);
    setPreview(null); // force a fresh preview before applying again
  }

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

      <h2 className="mt-10 font-display text-xl font-bold text-navy">Fix Mislabeled Period</h2>
      <p className="mt-2 text-sm text-ink-soft">
        One-time tool for an upload labeled under the wrong month — relabels it across every
        table that stores a period, and every site at once. Always run a preview first; it
        flags any site that already has real data under the correct period so that data
        isn&apos;t overwritten or merged incorrectly. Those sites are skipped automatically
        and listed for manual review.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-ink-soft uppercase tracking-wide">
            Wrong period
          </span>
          <input
            type="month"
            value={wrongPeriod}
            onChange={(e) => {
              setWrongPeriod(e.target.value);
              setPreview(null);
              setApplyResult(null);
            }}
            className="rounded border border-rule-strong bg-white px-2 py-1.5 outline-none focus:border-navy"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-ink-soft uppercase tracking-wide">
            Correct period
          </span>
          <input
            type="month"
            value={correctPeriod}
            onChange={(e) => {
              setCorrectPeriod(e.target.value);
              setPreview(null);
              setApplyResult(null);
            }}
            className="rounded border border-rule-strong bg-white px-2 py-1.5 outline-none focus:border-navy"
          />
        </label>
        <button
          onClick={runPreview}
          disabled={previewing || !wrongPeriod || !correctPeriod}
          className="rounded border border-navy px-4 py-2 text-sm font-medium text-navy hover:bg-navy hover:text-white disabled:opacity-60"
        >
          {previewing ? "Checking…" : "Preview"}
        </button>
      </div>
      {previewError && <p className="mt-3 text-sm text-grade-low">{previewError}</p>}

      {preview && (
        <div className="mt-4 rounded border border-rule-strong bg-white p-4 text-sm">
          <p>
            <strong>{preview.totalImports}</strong> import(s) across{" "}
            <strong>{preview.totalImports - preview.conflictingSites.length}</strong> site(s)
            will move from <strong>{monthLabel(preview.wrongPeriod)}</strong> to{" "}
            <strong>{monthLabel(preview.correctPeriod)}</strong>.
          </p>
          <p className="mt-1 text-ink-soft">
            Also relabeling {preview.siteSnapshotsToFix} site snapshot(s),{" "}
            {preview.writerSnapshotsToFix} writer snapshot(s), {preview.siteDeltasToFix} site
            daily-delta row(s), and {preview.writerDeltasToFix} writer daily-delta row(s).
          </p>
          {preview.conflictingSites.length > 0 && (
            <div className="mt-3 rounded border border-grade-low bg-white p-3">
              <p className="font-medium text-grade-low">
                {preview.conflictingSites.length} site(s) already have data for{" "}
                {monthLabel(preview.correctPeriod)} — these will be skipped, not overwritten:
              </p>
              <ul className="mt-1 list-inside list-disc text-ink-soft">
                {preview.conflictingSites.map((s) => (
                  <li key={s.siteId}>{s.siteName}</li>
                ))}
              </ul>
            </div>
          )}
          {preview.siteArchiveConflicts.length > 0 && (
            <p className="mt-2 text-xs text-grade-low">
              Note: {preview.siteArchiveConflicts.length} site(s) also have conflicting
              archived data for this period — those archive rows will be skipped too.
            </p>
          )}
          <button
            onClick={applyFix}
            disabled={applying}
            className="mt-4 rounded bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-soft disabled:opacity-60"
          >
            {applying ? "Applying…" : "Apply Fix"}
          </button>
        </div>
      )}
      {applyError && <p className="mt-3 text-sm text-grade-low">{applyError}</p>}
      {applyResult && (
        <div className="mt-4 rounded border border-grade-good bg-white p-4 text-sm">
          <p className="font-medium text-grade-good">Fix applied.</p>
          <p className="mt-1 text-ink-soft">
            {applyResult.importsFixed} import(s), {applyResult.siteSnapshotsFixed} site
            snapshot(s), {applyResult.writerSnapshotsFixed} writer snapshot(s),{" "}
            {applyResult.siteDeltasFixed} site delta row(s), {applyResult.writerDeltasFixed}{" "}
            writer delta row(s), and {applyResult.siteArchiveFixed +
              applyResult.writerArchiveFixed}{" "}
            archive row(s) relabeled.
          </p>
          {applyResult.skippedSites.length > 0 && (
            <div className="mt-2">
              <p className="font-medium text-grade-low">
                Skipped {applyResult.skippedSites.length} site(s) — already had data for the
                correct period, review manually:
              </p>
              <ul className="mt-1 list-inside list-disc text-ink-soft">
                {applyResult.skippedSites.map((s) => (
                  <li key={s.siteId}>{s.siteName}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

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
