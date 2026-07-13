"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { SECTIONS, sectionColor } from "@/lib/depthCharts";
import { formatDuration } from "@/lib/trafficFormat";
import type { DepthChartRole, DepthChartWriter, SectionKey } from "@/lib/depthCharts";
import type { WriterTrafficSummary } from "@/lib/traffic";

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

function WriterTrafficPanel({ writerId }: { writerId: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WriterTrafficSummary | null>(null);

  async function toggle() {
    if (!open && !data) {
      setLoading(true);
      const res = await fetch(`/api/depth-chart-writers/card/${writerId}/traffic`);
      const d = await res.json();
      setData(d);
      setLoading(false);
    }
    setOpen((o) => !o);
  }

  return (
    <div className="mt-3 border-t border-rule pt-2">
      <button
        type="button"
        onClick={toggle}
        className="text-xs font-medium text-ink-soft hover:text-navy"
      >
        {open ? "Hide traffic ▲" : "View traffic ▾"}
      </button>
      {open && (
        <div className="mt-2 text-xs">
          {loading ? (
            <p className="text-ink-soft">Loading…</p>
          ) : !data?.matched ? (
            <p className="italic text-ink-soft">
              No traffic data matched{data?.matchName ? ` for "${data.matchName}"` : ""} yet.
              If this doesn&apos;t look right, check the traffic dashboard name on this card.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="font-data text-ink-soft">{data.latestPeriodLabel}</p>

              {data.topArticles && data.topArticles.length > 0 && (
                <div>
                  <p className="font-data uppercase tracking-wide text-ink-soft">
                    Top articles
                  </p>
                  <ul className="mt-1 space-y-1.5">
                    {data.topArticles.map((a, i) => (
                      <li key={i}>
                        <div className="truncate">{a.article_title}</div>
                        <div className="font-data text-[11px] text-ink-soft">
                          {a.pageviews.toLocaleString()} views · {formatDuration(a.avg_time_on_page)} avg
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.recentArticles && data.recentArticles.length > 0 && (
                <div>
                  <p className="font-data uppercase tracking-wide text-ink-soft">
                    Recent articles
                  </p>
                  <ul className="mt-1 space-y-1">
                    {data.recentArticles.map((a, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="truncate">{a.article_title}</span>
                        <span className="shrink-0 text-ink-soft">
                          {a.first_published_date
                            ? new Date(a.first_published_date).toLocaleDateString()
                            : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.monthly && data.monthly.length > 1 && (
                <div>
                  <p className="font-data uppercase tracking-wide text-ink-soft">
                    Monthly trend
                  </p>
                  <ul className="mt-1 space-y-1">
                    {data.monthly.map((m) => (
                      <li key={m.period_key} className="flex justify-between">
                        <span>{m.period_label}</span>
                        <span className="font-data text-ink-soft">
                          {m.totalPageviews.toLocaleString()} views
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WriterCard({
  siteId,
  writer,
  roles,
  onRoleCreated,
  onSaved,
  onDiscardNew,
}: {
  siteId: number;
  writer: DepthChartWriter | null; // null = new, unsaved card
  roles: DepthChartRole[];
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
        <div className="flex items-start justify-between gap-2">
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
          <button
            onClick={startEdit}
            className="text-xs font-medium text-ink-soft hover:text-navy"
          >
            Edit
          </button>
        </div>
        <WriterTrafficPanel writerId={writer.id} />
      </div>
    );
  }

  return (
    <div className="card rounded-md border-l-4 p-4" style={{ borderLeftColor: color }}>
      <div className="space-y-2">
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
