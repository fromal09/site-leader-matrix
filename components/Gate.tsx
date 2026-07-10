"use client";

import { useAuth } from "./AuthProvider";
import { LoginScreen } from "./LoginScreen";

export function Gate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-soft">
        Loading…
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
