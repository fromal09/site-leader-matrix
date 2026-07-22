"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { parseOnsiTrafficCsv } from "@/lib/trafficCsv";
import type { OnsiTrafficCsvGroup } from "@/lib/trafficCsv";

type Site = {
  id: number;
  site_name: string;
  site_topic: string;
  division: string;
  url_path: string | null;
};

type ImportRow = {
  id: number;
  site_id: number;
  site_name: string;
  site_topic: string;
  division: string;
  period_key: string;
  period_label: string;
  row_count: number;
  imported_by: string | null;
  imported_at: string;
};

type GroupStatus = "idle" | "uploading" | "done" | "error" | "skipped";
const DO_NOT_INCLUDE = "__skip__";

type GroupState = {
  group: OnsiTrafficCsvGroup;
  siteId: string;
  status: GroupStatus;
  error: string | null;
};

function monthKeyToLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function OnsiTrafficPage() {
  const { requireAuth } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [fileName, setFileName] = useState<string | null>(null);
  const [groupStates, setGroupStates] = useState<GroupState[]>([]);
  const [skippedRows, setSkippedRows] = useState(0);
  const [unclassifiedRows, setUnclassifiedRows] = useState(0);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [monthKey, setMonthKey] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    setLoadingList(true);
    const [sitesRes, importsRes] = await Promise.all([
      fetch("/api/onsi/sites").then((r) => r.json()),
      fetch("/api/onsi/traffic").then((r) => r.json()),
    ]);
    setSites(sitesRes.sites ?? []);
    setImports(importsRes.imports ?? []);
    setLoadingList(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleFile(file: File) {
    setFormError(null);
    setFileName(file.name);
    const text = await file.text();
    const result = parseOnsiTrafficCsv(text);
    setSkippedRows(result.skippedRows);
    setUnclassifiedRows(result.unclassifiedRows);
    setMissingColumns(result.missingColumns);
    setGroupStates(
      result.groups.map((group) => {
        const matched = sites.find((s) => s.url_path === group.urlPath);
        return {
          group,
          siteId: matched ? String(matched.id) : "",
          status: "idle" as GroupStatus,
          error: null,
        };
      })
    );
  }

  function updateGroupSite(index: number, siteId: string) {
    setGroupStates((prev) => prev.map((g, i) => (i === index ? { ...g, siteId } : g)));
  }

  const allSitesChosen = useMemo(
    () => groupStates.length > 0 && groupStates.every((g) => g.siteId),
    [groupStates]
  );

  async function handleUploadAll() {
    if (!requireAuth()) return;
    if (!monthKey) {
      setFormError("Choose which month this data covers.");
      return;
    }
    if (!allSitesChosen) {
      setFormError("Choose a site for every group below.");
      return;
    }

    setFormError(null);
    setUploading(true);

    for (let i = 0; i < groupStates.length; i++) {
      const g = groupStates[i];
      if (g.siteId === DO_NOT_INCLUDE) {
        setGroupStates((prev) => prev.map((gs, idx) => (idx === i ? { ...gs, status: "skipped" } : gs)));
        continue;
      }
      setGroupStates((prev) =>
        prev.map((gs, idx) => (idx === i ? { ...gs, status: "uploading", error: null } : gs))
      );
      const res = await fetch("/api/onsi/traffic/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: Number(g.siteId),
          urlPath: g.group.urlPath,
          periodKey: monthKey,
          periodLabel: monthKeyToLabel(monthKey),
          rows: g.group.rows,
        }),
      });
      if (res.ok) {
        setGroupStates((prev) => prev.map((gs, idx) => (idx === i ? { ...gs, status: "done" } : gs)));
      } else {
        const d = await res.json().catch(() => ({}));
        setGroupStates((prev) =>
          prev.map((gs, idx) => (idx === i ? { ...gs, status: "error", error: d.error ?? "Upload failed." } : gs))
        );
      }
    }

    setUploading(false);
    loadAll();
  }

  async function handleDelete(id: number) {
    if (!requireAuth()) return;
    if (!window.confirm("Delete this traffic import? This can't be undone.")) return;
    await fetch(`/api/onsi/traffic/${id}`, { method: "DELETE" });
    loadAll();
  }

  const totalRows = groupStates.reduce((sum, g) => sum + g.group.rows.length, 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="font-data text-xs uppercase tracking-widest text-ink-soft">OnSI Network</p>
        <h1 className="font-display text-3xl font-bold text-navy">Traffic Data</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Upload a monthly article-performance export. Since every OnSI site shares the same
          si.com hostname, sites are told apart by URL path instead — the export needs a URL
          column for this to work. Re-uploading the same site and month replaces what's
          there, so a partial-month upload followed by a fuller one later just works.
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

        {groupStates.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="rounded border border-rule-strong bg-white p-3 text-sm">
              <p>
                <strong>{fileName}</strong> — {totalRows.toLocaleString()} article row
                {totalRows === 1 ? "" : "s"} across {groupStates.length} site
                {groupStates.length === 1 ? "" : "s"}
                {skippedRows > 0 && (
                  <span className="text-ink-soft"> ({skippedRows} skipped — no title)</span>
                )}
                {unclassifiedRows > 0 && (
                  <span className="text-grade-low">
                    {" "}
                    ({unclassifiedRows} couldn&apos;t be matched to a URL path)
                  </span>
                )}
              </p>
              {missingColumns.length > 0 && (
                <p className="mt-1 text-xs text-grade-low">
                  Couldn&apos;t find columns for: {missingColumns.join(", ")}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-ink-soft uppercase tracking-wide">
                Month this data covers
              </label>
              <input
                type="month"
                className="mt-1 w-full max-w-xs rounded border border-rule-strong bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              {groupStates.map((g, i) => {
                const matched = sites.find((s) => s.url_path === g.group.urlPath);
                return (
                  <div
                    key={i}
                    className="flex flex-col gap-2 rounded border border-rule-strong bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="text-sm">
                      <div className="font-data text-xs text-ink-soft">{g.group.urlPath}</div>
                      <div>{g.group.rows.length.toLocaleString()} rows</div>
                      {!matched && (
                        <div className="text-xs text-ink-soft">
                          New URL path — we&apos;ll remember this mapping after upload.
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="rounded border border-rule-strong bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
                        value={g.siteId}
                        onChange={(e) => updateGroupSite(i, e.target.value)}
                        disabled={g.status === "uploading" || g.status === "done" || g.status === "skipped"}
                      >
                        <option value="" disabled>
                          Choose a site…
                        </option>
                        {Object.entries(
                          sites.reduce<Record<string, Site[]>>((acc, s) => {
                            const div = s.division || "Unassigned";
                            (acc[div] ??= []).push(s);
                            return acc;
                          }, {})
                        ).map(([div, divSites]) => (
                          <optgroup key={div} label={div}>
                            {divSites.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.site_name} ({s.site_topic})
                              </option>
                            ))}
                          </optgroup>
                        ))}
                        <option value={DO_NOT_INCLUDE}>Do Not Include</option>
                      </select>
                      {g.status === "uploading" && <span className="text-xs text-ink-soft">Uploading…</span>}
                      {g.status === "done" && <span className="text-xs text-grade-good">Done</span>}
                      {g.status === "skipped" && <span className="text-xs text-ink-soft">Skipped</span>}
                      {g.status === "error" && <span className="text-xs text-grade-low">{g.error}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {formError && <p className="text-sm text-grade-low">{formError}</p>}

            <button
              onClick={handleUploadAll}
              disabled={uploading}
              className="rounded bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-soft disabled:opacity-60"
            >
              {uploading
                ? "Uploading…"
                : groupStates.length > 1
                ? `Upload All (${groupStates.length} sites)`
                : "Upload"}
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
                <th className="py-2 pr-4">Division</th>
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
                  <td className="py-2 pr-4 font-data text-xs text-ink-soft">{imp.division}</td>
                  <td className="py-2 pr-4">{imp.period_label}</td>
                  <td className="py-2 pr-4 font-data">{imp.row_count.toLocaleString()}</td>
                  <td className="py-2 pr-4">{imp.imported_by ?? "—"}</td>
                  <td className="py-2 pr-4 text-xs text-ink-soft">
                    {new Date(imp.imported_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <Link
                      href={`/onsi/traffic-data/${imp.id}`}
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
