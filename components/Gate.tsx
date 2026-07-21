"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { LoginScreen } from "./LoginScreen";

export function Gate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isOnsiRoute = pathname === "/onsi" || pathname.startsWith("/onsi/");
  const mismatched =
    !!session && ((isOnsiRoute && session.network !== "onsi") || (!isOnsiRoute && session.network === "onsi"));

  useEffect(() => {
    if (mismatched && session) {
      router.replace(session.network === "onsi" ? "/onsi" : "/");
    }
  }, [mismatched, session, router]);

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

  if (mismatched) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-soft">
        Redirecting…
      </div>
    );
  }

  return <>{children}</>;
}
