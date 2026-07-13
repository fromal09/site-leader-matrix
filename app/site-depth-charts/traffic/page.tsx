"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { parseTrafficCsv } from "@/lib/trafficCsv";
import { trafficImportHref } from "@/lib/routes";
import type { Site } from "@/lib/types";

type ImportRow = {
  id: number;
  site_id: number;
  site_name: string;
  site_topic: string;
  period_key: string;
  period_label: string;
  row_count: number;
  imported_by: string | null;
  imported_at: string;
};

function monthKeyToLabel(monthKey: string): string {
  // monthKey is "YYYY-MM" from <input type="month">
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function TrafficPage() {
  const { requireAuth } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ReturnType<typeof parseTrafficCsv> | null>(null);
  const [siteId, setSiteId] = useState<string>("");
  const [monthKey, setMonthKey] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  async function loadAll() {
    setLoadingList(true);
    const [sitesRes, importsRes] = await Promise.all([
      fetch("/api/sites").then((r) => r.json()),
      fetch("/api/traffic").then((r) => r.json()),
    ]);
    setSites(sitesRes.sites ?? []);
    setImports(importsRes.imports ?? []);
    setLoadingList(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const matchedSite = useMemo(() => {
    if (!parsed?.hostname) return null;
    return sites.find((s) => s.hostname === parsed.hostname) ?? null;
  }, [parsed, sites]);

  useEffect(() => {
    if (matchedSite) setSiteId(String(matchedSite.id));
  }, [matchedSite]);

  async function handleFile(file: File) {
    setUploadError(null);
    setUploadSuccess(null);
    setFileName(file.name);
    const text = await file.text();
    const result = parseTrafficCsv(text);
    setParsed(result);
  }

  async function handleUpload() {
    if (!requireAuth()) return;
    if (!parsed || parsed.rows.length === 0) {
      setUploadError("Nothing to upload — choose a CSV first.");
      return;
    }
    if (!siteId) {
      setUploadError("Choose which site this data belongs to.");
      return;
    }
    if (!monthKey) {
      setUploadError("Choose which month this data covers.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    const res = await fetch("/api/traffic/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: Number(siteId),
        hostname: parsed.hostname,
        periodKey: monthKey,
        periodLabel: monthKeyToLabel(monthKey),
        rows: parsed.rows,
      }),
    });
    setUploading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setUploadError(d.error ?? "Upload failed.");
      return;
    }
    setUploadSuccess(`Imported ${parsed.rows.length.toLocaleString()} rows.`);
    setParsed(null);
    setFileName(null);
    loadAll();
  }

  async function handleDelete(id: number) {
    if (!requireAuth()) return;
    if (!window.confirm("Delete this traffic import? This can't be undone.")) return;
    await fetch(`/api/traffic/${id}`, { method: "DELETE" });
    loadAll();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="font-data text-xs uppercase tracking-widest text-ink-soft">
          Site Depth Charts
        </p>
        <h1 className="font-display text-3xl font-bold text-navy">Traffic Data</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Upload a monthly article-performance export. Re-uploading the same site and month
          replaces what's there — safe for a partial-month upload followed by a fuller one
          later.
        </p>
      </div>

      <div className="card mb-8 rounded-md p-5">
        <h2 className="font-display text-lg font-semibold text-navy">Upload a CSV</h2>

        <div className="mt-3">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="text-sm"
          />
        </div>

        {parsed && (
          <div className="mt-4 space-y-3">
            <div className="rounded border border-rule-strong bg-white p-3 text-sm">
              <p>
                <strong>{fileName}</strong> — {parsed.rows.length.toLocaleString()} article
                row{parsed.rows.length === 1 ? "" : "s"} parsed
                {parsed.skippedRows > 0 && (
                  <span className="text-ink-soft">
                    {" "}
                    ({parsed.skippedRows} skipped — no title)
                  </span>
                )}
              </p>
              {parsed.hostname && (
                <p className="mt-1 font-data text-xs text-ink-soft">
                  Detected hostname: {parsed.hostname}
                  {matchedSite && ` → matched to ${matchedSite.site_name}`}
                </p>
              )}
              {parsed.missingColumns.length > 0 && (
                <p className="mt-1 text-xs text-grade-low">
                  Couldn&apos;t find columns for: {parsed.missingColumns.join(", ")}
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-ink-soft uppercase tracking-wide">
                  Site {matchedSite && <span className="text-grade-good">(auto-detected)</span>}
                </label>
                <select
                  className="mt-1 w-full rounded border border-rule-strong bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                >
                  <option value="" disabled>
                    Choose a site…
                  </option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.site_name} ({s.site_topic})
                    </option>
                  ))}
                </select>
                {parsed.hostname && !matchedSite && (
                  <p className="mt-1 text-xs text-ink-soft">
                    New hostname — we&apos;ll remember this mapping after you upload.
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-ink-soft uppercase tracking-wide">
                  Month this data covers
                </label>
                <input
                  type="month"
                  className="mt-1 w-full rounded border border-rule-strong bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
                  value={monthKey}
                  onChange={(e) => setMonthKey(e.target.value)}
                />
              </div>
            </div>

            {uploadError && <p className="text-sm text-grade-low">{uploadError}</p>}
            {uploadSuccess && <p className="text-sm text-grade-good">{uploadSuccess}</p>}

            <button
              onClick={handleUpload}
              disabled={uploading}
              className="rounded bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-soft disabled:opacity-60"
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>
        )}
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold text-navy">Past Imports</h2>
      {loadingList ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : imports.length === 0 ? (
        <p className="text-sm italic text-ink-soft">No traffic data imported yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-rule-strong font-data text-xs uppercase tracking-wide text-ink-soft">
                <th className="py-2 pr-4">Site</th>
                <th className="py-2 pr-4">Period</th>
                <th className="py-2 pr-4">Rows</th>
                <th className="py-2 pr-4">Uploaded By</th>
                <th className="py-2 pr-4">Uploaded At</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {imports.map((imp) => (
                <tr key={imp.id} className="border-b border-rule">
                  <td className="py-2 pr-4">
                    <div className="font-medium text-ink">{imp.site_name}</div>
                    <div className="text-xs text-ink-soft">{imp.site_topic}</div>
                  </td>
                  <td className="py-2 pr-4">{imp.period_label}</td>
                  <td className="py-2 pr-4 font-data">{imp.row_count.toLocaleString()}</td>
                  <td className="py-2 pr-4">{imp.imported_by ?? "—"}</td>
                  <td className="py-2 pr-4 text-xs text-ink-soft">
                    {new Date(imp.imported_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <Link
                      href={trafficImportHref(imp.id)}
                      className="mr-3 text-xs font-medium text-navy hover:underline"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => handleDelete(imp.id)}
                      className="text-xs font-medium text-grease-red hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
