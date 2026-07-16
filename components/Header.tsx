"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { TRAFFIC_BASE } from "@/lib/routes";
import { MentionBadge } from "./MentionBadge";

export function Header() {
  const { session, openLogin, logout } = useAuth();

  return (
    <header className="border-b-2 border-navy bg-paper-raised">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-base font-bold tracking-tight text-navy sm:text-xl">
            SPORTS DIRECTORS REFERENCE GUIDE
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {session ? (
            <>
              <span className="font-data text-xs text-ink-soft">
                Signed in as <strong className="text-ink">{session.name}</strong>
              </span>
              <MentionBadge name={session.name} />
              <Link
                href={TRAFFIC_BASE}
                className="text-xs font-medium text-ink-soft hover:text-navy"
              >
                Traffic Data
              </Link>
              <Link
                href="/admin"
                className="text-xs font-medium text-ink-soft hover:text-navy"
              >
                Admin
              </Link>
              <button
                onClick={logout}
                className="text-xs font-medium text-ink-soft hover:text-grease-red"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={openLogin}
              className="rounded border border-navy px-3 py-1 text-xs font-medium text-navy hover:bg-navy hover:text-white"
            >
              Manager sign-in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
