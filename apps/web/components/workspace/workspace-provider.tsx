"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth/auth-provider";
import { ApiError } from "../../lib/api";
import { getDashboardSummary, type DashboardFilter, type DashboardSummary } from "../../lib/dashboard";

type WorkspaceState = { summary: DashboardSummary | null; loading: boolean; error: string; filter: DashboardFilter;
  setFilter: (filter: DashboardFilter) => void; retry: () => void };
const WorkspaceContext = createContext<WorkspaceState | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth(); const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [filter, setFilter] = useState<DashboardFilter>({ period: "thisMonth" });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    if (!user?.currentBusinessId) { router.replace("/onboarding"); return; }
    const abort = new AbortController();
    let alive = true;
    getDashboardSummary(filter, abort.signal).then((next) => {
      if (!alive) return;
      if (!next.business?.onboardingCompleted) { router.replace("/onboarding"); return; }
      setSummary(next); setError("");
    }).catch((err: unknown) => {
      if (!alive) return;
      if (err instanceof ApiError && err.status === 401) { router.replace("/login"); return; }
      setError(err instanceof ApiError && err.status === 403 ? "You don’t have access to this business. Sign in with an owner account." : "We couldn’t load your workspace. Please try again.");
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; abort.abort(); };
  }, [user?.currentBusinessId, filter, attempt, router]);
  return <WorkspaceContext.Provider value={{ summary, loading, error, filter,
    setFilter: (next) => { setLoading(true); setError(""); setFilter(next); },
    retry: () => { setLoading(true); setError(""); retry(); },
  }}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("WorkspaceProvider is required");
  return context;
}
