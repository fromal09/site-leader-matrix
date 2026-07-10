"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";

export function LoginModal() {
  const { loginOpen, closeLogin, login } = useAuth();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loginOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await login(name, password);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <div className="card w-full max-w-sm rounded-lg p-6">
        <div className="mb-4">
          <div className="font-display text-xs tracking-[0.2em] text-ink-soft uppercase">
            Manager Sign-In
          </div>
          <h2 className="font-display text-2xl font-semibold text-navy">
            Enter the war room
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-soft uppercase tracking-wide">
              Your name
            </label>
            <input
              autoFocus
              className="mt-1 w-full rounded border border-rule-strong bg-white px-3 py-2 text-sm outline-none focus:border-navy"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Adam"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-soft uppercase tracking-wide">
              Manager password
            </label>
            <input
              type="password"
              className="mt-1 w-full rounded border border-rule-strong bg-white px-3 py-2 text-sm outline-none focus:border-navy"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-grade-low">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeLogin}
              className="px-3 py-1.5 text-sm text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-navy px-4 py-1.5 text-sm font-medium text-white hover:bg-navy-soft disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
