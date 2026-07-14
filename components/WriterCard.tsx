"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { SECTIONS, sectionColor } from "@/lib/depthCharts";
import { WriterTrafficPanel } from "./WriterTrafficPanel";
import { WriterNotesPanel } from "./WriterNotesPanel";
import { formatCompactNumber, formatPercent, scrollDepthColor } from "@/lib/trafficFormat";
import {
  computeWriterObservations,
  observationBaseColor,
  observationBgOpacity,
} from "@/lib/observations";
import type { DepthChartRole, DepthChartWriter, SectionKey } from "@/lib/depthCharts";
import type { SiteTrafficTotals, WriterQuickStats } from "@/lib/traffic";

const ADD_NEW = "__add_new__";

function RoleSelect({
  roles,
  value,
  onChange,
  onRoleCreated,
}: {
  roles: DepthChartRole[];
  value: string;
  onChange: (label: string) => void;
  onRoleCreated: (role: DepthChartRole) => void;
}) {
  const [addingNew, setAddingNew] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newSection, setNewSection] = useState<SectionKey>("contributors");
  const [busy, setBusy] = useState(false);

  async function submitNewRole() {
    if (!newLabel.trim()) return;
    setBusy(true);
    const res = await fetch("/api/depth-chart-roles", {
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

function QuickStatBadge({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="whitespace-nowrap rounded-full border px-2 py-0.5 font-data text-[11px]"
      style={{
        borderColor: color ?? "var(--rule-strong)",
        color: color ?? "var(--ink-soft)",
      }}
    >
      {label}
    </span>
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

export function WriterCard({
  siteId,
  writer,
  roles,
  quickStats,
  siteTotals,
  onRoleCreated,
  onSaved,
  onDiscardNew,
}: {
  siteId: number;
  writer: DepthChartWriter | null; // null = new, unsaved card
  roles: DepthChartRole[];
  quickStats?: WriterQuickStats;
  siteTotals?: SiteTrafficTotals | null;
  onRoleCreated: (role: DepthChartRole) => void;
  onSaved: () => void;
  onDiscardNew: () => void;
}) {
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
          },
          {
            weightedAvgScrollDepth: siteTotals.weightedAvgScrollDepth,
            pvPerPublishedArticle: siteTotals.pvPerPublishedArticle,
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
      ? await fetch(`/api/depth-chart-writers/card/${writer.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body,
        })
      : await fetch(`/api/depth-chart-writers/${siteId}`, {
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
    await fetch(`/api/depth-chart-writers/card/${writer.id}`, { method: "DELETE" });
    setBusy(false);
    onSaved();
  }

  if (!editing && writer) {
    return (
      <div
        className="card rounded-md border-l-4 p-4"
        style={{ borderLeftColor: color }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-display text-lg font-semibold text-navy">
              {writer.name}
            </div>
            <span
              className="mt-1 inline-block rounded-full px-2 py-0.5 font-data text-[11px] uppercase tracking-wide"
              style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
            >
              {writer.role}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {quickStats && (
              <>
                <QuickStatBadge label={`${quickStats.articlesPublished} published`} />
                <QuickStatBadge
                  label={`${formatCompactNumber(quickStats.totalPageviews)} PVs`}
                />
                <QuickStatBadge
                  label={`${formatPercent(quickStats.weightedAvgScrollDepth)} scroll`}
                  color={scrollDepthColor(quickStats.weightedAvgScrollDepth)}
                />
              </>
            )}
            <button
              onClick={startEdit}
              className="text-xs font-medium text-ink-soft hover:text-navy"
            >
              Edit
            </button>
          </div>
        </div>
        {observations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {observations.map((o) => (
              <ObservationBadge key={o.key} direction={o.direction} tier={o.tier} label={o.label} />
            ))}
          </div>
        )}
        <WriterTrafficPanel writerId={writer.id} siteTotals={siteTotals ?? null} />
        <WriterNotesPanel writerId={writer.id} />
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
