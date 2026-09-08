"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequireAuth } from "../../components/auth/require-auth";
import { useAuth } from "../../components/auth/auth-provider";
import { FormMessage, buttonClass } from "../../components/forms/field";
import { api } from "../../lib/api";

export default function Page() {
  return <RequireAuth><Welcome /></RequireAuth>;
}
function Welcome() {
  const auth = useAuth(); const router = useRouter();
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true); setError("");
    try { await auth.logout(); router.replace("/login"); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to sign out"); }
    finally { setBusy(false); }
  }
  return <main className="grid min-h-dvh place-items-center bg-[#f4f6f9] px-6 py-12 text-slate-900">
    <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-800">GST Billing / Business</p>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{auth.user?.currentBusinessId ? "Your business is set up." : "Your account is ready."}</h1>
      <p className="mt-4 text-sm leading-7 text-slate-600">Welcome, {auth.user?.firstName}. {auth.user?.currentBusinessId ? "Your account and business profile are ready. Billing and dashboard features will arrive in later phases." : "Complete your business profile to finish onboarding."}</p>
      <dl className="my-7 border-y border-slate-200 py-5 text-sm">
        <dt className="text-slate-500">Account</dt><dd className="mt-1 break-all font-medium">{auth.user?.email}</dd>
        <dt className="mt-4 text-slate-500">Email status</dt><dd className="mt-1">{auth.user?.emailVerifiedAt ? "Verified" : "Not yet verified"}</dd>
      </dl>
      <div className="space-y-4">
        {error && <FormMessage>{error}</FormMessage>}
        {message && <FormMessage success>{message}</FormMessage>}
        <Link className={buttonClass} href="/onboarding">{auth.user?.currentBusinessId ? "Review business profile" : "Complete business setup"}</Link>
        {!auth.user?.emailVerifiedAt && <div className="flex flex-wrap justify-between gap-3 text-sm text-teal-800">
          <button type="button" disabled={busy} onClick={async () => {
            setBusy(true); setError("");
            try { const result = await api<{ message: string }>("/auth/request-verification", { method: "POST" }); setMessage(result.message); }
            catch (err) { setError(err instanceof Error ? err.message : "Unable to prepare verification"); }
            finally { setBusy(false); }
          }}>Prepare verification request</button>
          <Link href="/verify-email">Enter verification token</Link>
        </div>}
        <button disabled={busy} onClick={() => void logout()} className="w-full rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium">Sign out</button>
      </div>
    </section>
  </main>;
}
