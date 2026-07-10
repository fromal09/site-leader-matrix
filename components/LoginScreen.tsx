"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";

export function LoginScreen() {
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await login(name, password);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm rounded-lg p-6">
        <div className="mb-4 text-center">
          <div className="font-display text-xs tracking-[0.2em] text-ink-soft uppercase">
            Site Leader Matrix
          </div>
          <h1 className="font-display text-2xl font-semibold text-navy">
            Manager Sign-In Required
          </h1>
          <p className="mt-1 text-xs text-ink-soft">
            Site leader evaluations are internal. Sign in to continue.
          </p>
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
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-soft disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
