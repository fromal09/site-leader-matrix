"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import type { DepthChartRole, DepthChartWriter } from "@/lib/depthCharts";

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
  const [busy, setBusy] = useState(false);

  async function submitNewRole() {
    if (!newLabel.trim()) return;
    setBusy(true);
    const res = await fetch("/api/depth-chart-roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel.trim() }),
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
      <div className="flex gap-2">
        <input
          autoFocus
          className="flex-1 rounded border border-rule-strong bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
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
        <button
          type="button"
          onClick={submitNewRole}
          disabled={busy}
          className="rounded bg-navy px-2 py-1 text-xs font-medium text-white hover:bg-navy-soft disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => setAddingNew(false)}
          className="px-2 py-1 text-xs text-ink-soft hover:text-ink"
        >
          Cancel
        </button>
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    if (!requireAuth()) return;
    setName(writer?.name ?? "");
    setRole(writer?.role ?? "");
    setTrafficName(writer?.traffic_dashboard_name ?? "");
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
      <div className="card rounded-md p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-display text-lg font-semibold text-navy">
              {writer.name}
            </div>
            <span className="mt-1 inline-block rounded-full bg-navy/10 px-2 py-0.5 font-data text-[11px] uppercase tracking-wide text-navy">
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
        <p className="mt-3 text-xs italic text-ink-soft">
          Traffic performance coming soon.
        </p>
      </div>
    );
  }

  return (
    <div className="card rounded-md p-4">
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
          <label className="text-xs font-medium text-ink-soft uppercase tracking-wide">
            Traffic dashboard name{" "}
            <span className="normal-case text-ink-soft">
              (internal — not shown on the card)
            </span>
          </label>
          <input
            className="mt-1 w-full rounded border border-rule-strong bg-white px-2 py-1.5 text-sm outline-none focus:border-navy"
            value={trafficName}
            onChange={(e) => setTrafficName(e.target.value)}
            placeholder="Name as it appears in the traffic dashboard"
          />
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
