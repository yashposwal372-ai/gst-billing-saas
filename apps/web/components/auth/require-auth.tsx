"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { buttonClass } from "../forms/field";

export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth(); const router = useRouter();
  useEffect(() => { if (auth.status === "unauthenticated") router.replace("/login"); }, [auth.status, router]);
  if (auth.status !== "authenticated") return <main className="grid min-h-dvh place-items-center bg-slate-50 p-8 text-slate-800">
    <div role="status" className="max-w-md text-center">
      <p className="mb-5">{auth.status === "error" ? auth.error : "Checking your session…"}</p>
      {auth.status === "error" && <button className={buttonClass} onClick={() => void auth.refreshUser()}>Try again</button>}
    </div>
  </main>;
  return children;
}
