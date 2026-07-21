"use client";

import { useAuth } from "./AuthProvider";
import { Header } from "./Header";
import { OnsiHeader } from "./OnsiHeader";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  return (
    <>
      {session?.network === "onsi" ? <OnsiHeader /> : <Header />}
      {children}
    </>
  );
}
