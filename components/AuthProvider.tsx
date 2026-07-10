"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Session = { name: string } | null;

type AuthContextType = {
  session: Session;
  loading: boolean;
  loginOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
  login: (name: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  requireAuth: () => boolean; // returns true if already authed, else opens modal and returns false
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>(null);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => setSession(d.session))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (name: string, password: string) => {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    });
    const data = await res.json();
    if (!res.ok) return data.error ?? "Login failed.";
    setSession({ name: data.name });
    setLoginOpen(false);
    return null;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setSession(null);
  }, []);

  const requireAuth = useCallback(() => {
    if (session) return true;
    setLoginOpen(true);
    return false;
  }, [session]);

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        loginOpen,
        openLogin: () => setLoginOpen(true),
        closeLogin: () => setLoginOpen(false),
        login,
        logout,
        requireAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
