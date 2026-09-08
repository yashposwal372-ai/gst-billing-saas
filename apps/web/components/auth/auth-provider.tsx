"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "../../lib/api";
import type { User, AuthResult } from "../../lib/auth-types";

type Status = "loading" | "authenticated" | "unauthenticated" | "error";
type AuthState = { user: User | null; status: Status; error: string; refreshUser: () => Promise<void>; setUser: (user: User) => void; logout: () => Promise<void> };
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, updateUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const refreshUser = useCallback(async () => {
    try {
      const result = await api<AuthResult>("/auth/me");
      updateUser(result.user); setStatus("authenticated"); setError("");
    } catch (err) {
      updateUser(null);
      if (err instanceof ApiError && err.status === 401) setStatus("unauthenticated");
      else { setStatus("error"); setError(err instanceof Error ? err.message : "Unable to reach the API"); }
    }
  }, []);
  useEffect(() => { void refreshUser(); }, [refreshUser]);
  useEffect(() => {
    const ended = () => { updateUser(null); setStatus("unauthenticated"); };
    window.addEventListener("gst:session-ended", ended);
    return () => window.removeEventListener("gst:session-ended", ended);
  }, []);
  return <AuthContext.Provider value={{ user, status, error, refreshUser,
    setUser: (next) => { updateUser(next); setStatus("authenticated"); setError(""); },
    logout: async () => { await api("/auth/logout", { method: "POST" }, false); updateUser(null); setStatus("unauthenticated"); },
  }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider is required");
  return context;
}
