"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { SECTIONS, sectionColor } from "@/lib/depthCharts";
import { WriterTrafficPanel } from "./WriterTrafficPanel";
import { WriterNotesPanel } from "./WriterNotesPanel";
import { formatCompactNumber, formatDuration, formatPercent } from "@/lib/trafficFormat";
import { StatTile } from "./StatTile";
import { FieldPinBadge } from "./FieldPinBadge";
import type { StickyNoteRecord, StickyColor } from "@/lib/stickyNotes";
import { rankAmong, rankTier, rankTierColors } from "@/lib/rankColor";
import {
  computeWriterObservations,
  observationBaseColor,
  observationBgOpacity,
} from "@/lib/observations";
import type { DepthChartRole, DepthChartWriter, SectionKey } from "@/lib/depthCharts";
import type { SiteTrafficTotals, WriterQuickStats } from "@/lib/traffic";
import { WriterAliasesEditor } from "./WriterAliasesEditor";

const ADD_NEW = "__add_new__";

function RoleSelect({
  roles,
  value,
  onChange,
  onRoleCreated,
  apiPrefix = "",
}: {
  roles: DepthChartRole[];
  value: string;
  onChange: (label: string) => void;
  onRoleCreated: (role: DepthChartRole) => void;
  apiPrefix?: string;
}) {
  const [addingNew, setAddingNew] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newSection, setNewSection] = useState<SectionKey>("contributors");
  const [busy, setBusy] = useState(false);

  async function submitNewRole() {
    if (!newLabel.trim()) return;
    setBusy(true);
    const res = await fetch(`${apiPrefix}/api/depth-chart-roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel.trim(), section: newSection }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json();
      onRoleCreated(data.role);
      onChange(data.role.label);
      setAddingNew(false);
      setNewLabel("");
    }
  }

  if (addingNew) {
    return (
      <div className="space-y-2 rounded border border-dashed border-rule-strong p-2">
        <input
          autoFocus
          className="w-full rounded border border-rule-strong bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
          placeholder="New role name"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitNewRole();
            }
          }}
        />
        <select
          className="w-full rounded border border-rule-strong bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
          value={newSection}
          onChange={(e) => setNewSection(e.target.value as SectionKey)}
        >
          {SECTIONS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setAddingNew(false)}
            className="px-2 py-1 text-xs text-ink-soft hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submitNewRole}
            disabled={busy}
            className="rounded bg-navy px-3 py-1 text-xs font-medium text-white hover:bg-navy-soft disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add role"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <select
      className="w-full rounded border border-rule-strong bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
      value={value}
      onChange={(e) => {
        if (e.target.value === ADD_NEW) {
          setAddingNew(true);
        } else {
          onChange(e.target.value);
        }
      }}
    >
      <option value="" disabled>
        Choose a role…
      </option>
      {roles.map((r) => (
        <option key={r.id} value={r.label}>
          {r.label}
        </option>
      ))}
      <option value={ADD_NEW}>+ Add new role…</option>
    </select>
  );
}

function ObservationBadge({
  direction,
  tier,
  label,
}: {
  direction: "above" | "below";
  tier: "mild" | "moderate" | "strong";
  label: string;
}) {
  const color = observationBaseColor(direction);
  const bgOpacity = observationBgOpacity(tier);
  return (
    <span
      className="whitespace-nowrap rounded-full px-2 py-0.5 font-data text-[11px] font-medium"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} ${bgOpacity}%, transparent)`,
      }}
    >
      {direction === "above" ? "▲" : "▼"} {label}
    </span>
  );
}

function peerTint(
  writerId: number,
  metric: (s: WriterQuickStats) => number | null,
  allQuickStats: Record<number, WriterQuickStats> | undefined
) {
  if (!allQuickStats) return null;
  const r = rankAmong(writerId, metric, allQuickStats);
  if (!r) return null;
  return rankTierColors(rankTier(r.rank, r.total));
}

export function WriterCard({
  siteId,
  writer,
  roles,
  quickStats,
  allQuickStats,
  siteTotals,
  onRoleCreated,
  onSaved,
  onDiscardNew,
  writerNotes = [],
  onAddNote,
  onRemoveNote,
  apiPrefix = "",
}: {
  siteId: number;
  writer: DepthChartWriter | null; // null = new, unsaved card
  roles: DepthChartRole[];
  quickStats?: WriterQuickStats;
  allQuickStats?: Record<number, WriterQuickStats>;
  siteTotals?: SiteTrafficTotals | null;
  onRoleCreated: (role: DepthChartRole) => void;
  onSaved: () => void;
  onDiscardNew: () => void;
  writerNotes?: StickyNoteRecord[];
  onAddNote?: (fieldLabel: string | null, body: string, color: StickyColor) => Promise<boolean>;
  onRemoveNote?: (id: number) => void;
  // "" for FanSided's own routes, "/onsi" to hit the OnSI mirror instead —
  // lets this same component serve both networks without duplication.
  apiPrefix?: string;
}) {
  const onAdd = onAddNote ?? (async () => false);
  const onRemove = onRemoveNote ?? (() => {});
  const { requireAuth } = useAuth();
  const [editing, setEditing] = useState(writer === null);
  const [name, setName] = useState(writer?.name ?? "");
  const [role, setRole] = useState(writer?.role ?? "");
  const [trafficName, setTrafficName] = useState(writer?.traffic_dashboard_name ?? "");
  const [showTrafficField, setShowTrafficField] = useState(
    Boolean(writer?.traffic_dashboard_name)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleObj = roles.find((r) => r.label === (writer?.role ?? role));
  const color = sectionColor(roleObj?.section ?? "contributors");

  const observations =
    quickStats && siteTotals
      ? computeWriterObservations(
          {
            weightedAvgScrollDepth: quickStats.weightedAvgScrollDepth,
            pvPerPublishedArticle: quickStats.pvPerPublishedArticle,
            weightedAvgTimeOnPage: quickStats.weightedAvgTimeOnPage,
          },
          {
            weightedAvgScrollDepth: siteTotals.weightedAvgScrollDepth,
            pvPerPublishedArticle: siteTotals.pvPerPublishedArticle,
            weightedAvgTimeOnPage: siteTotals.weightedAvgTimeOnPage,
          }
        )
      : [];

  function startEdit() {
    if (!requireAuth()) return;
    setName(writer?.name ?? "");
    setRole(writer?.role ?? "");
    setTrafficName(writer?.traffic_dashboard_name ?? "");
    setShowTrafficField(Boolean(writer?.traffic_dashboard_name));
    setError(null);
    setEditing(true);
  }

  function cancel() {
    if (writer === null) {
      onDiscardNew();
      return;
    }
    setEditing(false);
  }

  async function save() {
    if (!name.trim() || !role.trim()) {
      setError("Name and role are both required.");
      return;
    }
    setBusy(true);
    setError(null);
    const body = JSON.stringify({ name, role, trafficDashboardName: trafficName });
    const res = writer
      ? await fetch(`${apiPrefix}/api/depth-chart-writers/card/${writer.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body,
        })
      : await fetch(`${apiPrefix}/api/depth-chart-writers/${siteId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Something went wrong.");
      return;
    }
    setEditing(false);
    onSaved();
  }

  async function remove() {
    if (!writer) return;
    if (!window.confirm(`Remove ${writer.name} from this site's roster?`)) return;
    setBusy(true);
    await fetch(`${apiPrefix}/api/depth-chart-writers/card/${writer.id}`, { method: "DELETE" });
    setBusy(false);
    onSaved();
  }

  if (!editing && writer) {
    return (
      <div
        className="card relative rounded-md border-l-4 p-4"
        style={{ borderLeftColor: color }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-display text-lg font-semibold uppercase text-navy">
              {writer.name}
            </div>
            <span
              className="mt-1 inline-block rounded-full px-2 py-0.5 font-data text-[11px] uppercase tracking-wide"
              style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
            >
              {writer.role}
            </span>
          </div>
          <button
            onClick={startEdit}
            className="text-xs font-medium text-ink-soft hover:text-navy"
          >
            Edit
          </button>
        </div>
        {quickStats && (
          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            <div className="relative">
              <StatTile
                label="Published"
                value={quickStats.articlesPublished.toLocaleString()}
                tint={peerTint(writer.id, (s) => s.articlesPublished, allQuickStats)}
              />
              <FieldPinBadge
                notes={writerNotes.filter((n) => n.field_label === "Published")}
                onAdd={(body, color) => onAdd("Published", body, color)}
              />
            </div>
            <div className="relative">
              <StatTile
                label="Total PVs"
                value={formatCompactNumber(quickStats.totalPageviews)}
                tint={peerTint(writer.id, (s) => s.totalPageviews, allQuickStats)}
              />
              <FieldPinBadge
                notes={writerNotes.filter((n) => n.field_label === "Total PVs")}
                onAdd={(body, color) => onAdd("Total PVs", body, color)}
              />
            </div>
            <div className="relative">
              <StatTile
                label="Evergreen PVs"
                value={formatCompactNumber(
                  Math.max(0, quickStats.totalPageviews - quickStats.publishedPageviews)
                )}
                tint={peerTint(
                  writer.id,
                  (s) => Math.max(0, s.totalPageviews - s.publishedPageviews),
                  allQuickStats
                )}
              />
              <FieldPinBadge
                notes={writerNotes.filter((n) => n.field_label === "Evergreen PVs")}
                onAdd={(body, color) => onAdd("Evergreen PVs", body, color)}
              />
            </div>
            <div className="relative">
              <StatTile
                label="Scroll Depth"
                value={formatPercent(quickStats.weightedAvgScrollDepth)}
                tint={peerTint(writer.id, (s) => s.weightedAvgScrollDepth, allQuickStats)}
              />
              <FieldPinBadge
                notes={writerNotes.filter((n) => n.field_label === "Scroll Depth")}
                onAdd={(body, color) => onAdd("Scroll Depth", body, color)}
              />
            </div>
            <div className="relative">
              <StatTile
                label="Time on Page"
                value={formatDuration(quickStats.weightedAvgTimeOnPage)}
                tint={peerTint(writer.id, (s) => s.weightedAvgTimeOnPage, allQuickStats)}
              />
              <FieldPinBadge
                notes={writerNotes.filter((n) => n.field_label === "Time on Page")}
                onAdd={(body, color) => onAdd("Time on Page", body, color)}
              />
            </div>
            <div className="relative">
              <StatTile
                label="PVs / New Article"
                value={
                  quickStats.pvPerPublishedArticle !== null
                    ? formatCompactNumber(quickStats.pvPerPublishedArticle)
                    : "—"
                }
                tint={peerTint(writer.id, (s) => s.pvPerPublishedArticle, allQuickStats)}
              />
              <FieldPinBadge
                notes={writerNotes.filter((n) => n.field_label === "PVs / New Article")}
                onAdd={(body, color) => onAdd("PVs / New Article", body, color)}
              />
            </div>
          </div>
        )}
        {observations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {observations.map((o) => (
              <ObservationBadge key={o.key} direction={o.direction} tier={o.tier} label={o.label} />
            ))}
          </div>
        )}
        <WriterTrafficPanel writerId={writer.id} siteTotals={siteTotals ?? null} apiPrefix={apiPrefix} />
        <WriterNotesPanel writerId={writer.id} apiPrefix={apiPrefix} />
      </div>
    );
  }

  return (
    <div className="card rounded-md border-l-4 p-4" style={{ borderLeftColor: color }}>
      <div className="max-w-xl space-y-2">
        <div>
          <label className="text-xs font-medium text-ink-soft uppercase tracking-wide">
            Name
          </label>
          <input
            autoFocus
            className="mt-1 w-full rounded border border-rule-strong bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Writer's name"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-soft uppercase tracking-wide">
            Role
          </label>
          <div className="mt-1">
            <RoleSelect
              roles={roles}
              value={role}
              onChange={setRole}
              onRoleCreated={onRoleCreated}
              apiPrefix={apiPrefix}
            />
          </div>
        </div>
        <div>
          {showTrafficField ? (
            <>
              <label className="text-xs font-medium text-ink-soft uppercase tracking-wide">
                Traffic dashboard name{" "}
                <span className="normal-case text-ink-soft">
                  (internal — not shown on the card)
                </span>
              </label>
              <input
                autoFocus={trafficName === ""}
                className="mt-1 w-full rounded border border-rule-strong bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
                value={trafficName}
                onChange={(e) => setTrafficName(e.target.value)}
                placeholder="Name as it appears in the traffic dashboard"
              />
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowTrafficField(true)}
              className="text-xs font-medium text-ink-soft underline decoration-dotted hover:text-navy"
            >
              + Add traffic dashboard name (optional)
            </button>
          )}
        </div>
        {writer && <WriterAliasesEditor writerId={writer.id} apiPrefix={apiPrefix} />}
        {error && <p className="text-sm text-grade-low">{error}</p>}
        <div className="flex items-center justify-between pt-1">
          {writer ? (
            <button
              onClick={remove}
              disabled={busy}
              className="text-xs font-medium text-grease-red hover:underline disabled:opacity-60"
            >
              Remove
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={cancel}
              className="px-3 py-1 text-xs text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="rounded bg-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-soft disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
