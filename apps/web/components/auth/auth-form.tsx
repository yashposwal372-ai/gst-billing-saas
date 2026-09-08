"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { AuthShell } from "./auth-shell";
import { useAuth } from "./auth-provider";
import { Field, FormMessage, buttonClass } from "../forms/field";
import { api } from "../../lib/api";
import type { AuthResult } from "../../lib/auth-types";
import { email, fieldErrors, loginSchema, signupSchema, resetSchema, tokenSchema } from "../../lib/form-schemas";

type Mode = "login" | "signup" | "forgot-password" | "reset-password" | "verify-email";
const copy: Record<Mode, { title: string; description: string; button: string }> = {
  login: { title: "Welcome back", description: "Sign in to your business workspace.", button: "Sign in" },
  signup: { title: "Create your account", description: "Start with your account. We’ll help you set up your business next.", button: "Create account" },
  "forgot-password": { title: "Reset your password", description: "Enter your account email to prepare a password reset request.", button: "Prepare reset request" },
  "reset-password": { title: "Choose a new password", description: "Use your reset token to securely change your password.", button: "Update password" },
  "verify-email": { title: "Verify your email", description: "Enter your single-use verification token.", button: "Verify email" },
};
export function AuthForm({ mode }: { mode: Mode }) {
  const auth = useAuth(); const router = useRouter();
  useEffect(() => {
    if ((mode === "login" || mode === "signup") && auth.status === "authenticated")
      router.replace(auth.user?.currentBusinessId ? "/dashboard" : "/onboarding");
  }, [mode, auth.status, auth.user?.currentBusinessId, router]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const text = copy[mode];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const schema = mode === "signup" ? signupSchema : mode === "login" ? loginSchema : mode === "forgot-password" ? z.object({ email }) : mode === "reset-password" ? resetSchema : z.object({ token: tokenSchema });
    const parsed = schema.safeParse(data);
    if (!parsed.success) { setErrors(fieldErrors(parsed.error)); return; }
    setErrors({}); setBusy(true);
    const { confirmPassword: _confirmation, ...body } = parsed.data as Record<string, unknown>;
    try {
      if (mode === "login" || mode === "signup") {
        const result = await api<AuthResult>("/auth/" + mode, { method: "POST", body: JSON.stringify(body) }, false);
        auth.setUser(result.user);
        router.replace(result.user.currentBusinessId ? "/dashboard" : "/onboarding");
      } else {
        const result = await api<{ message: string }>("/auth/" + mode, { method: "POST", body: JSON.stringify(body) }, false);
        setMessage(result.message);
        if (mode === "verify-email" || mode === "reset-password") await auth.refreshUser();
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to complete request"); }
    finally { setBusy(false); }
  }
  return <AuthShell title={text.title} description={text.description}>
    <form onSubmit={submit} noValidate className="space-y-5">
      {error && <FormMessage>{error}</FormMessage>}
      {message && <FormMessage success>{message}</FormMessage>}
      <fieldset disabled={busy} className="space-y-5">
        {mode === "signup" && <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" name="firstName" autoComplete="given-name" required maxLength={80} error={errors.firstName} />
          <Field label="Last name" name="lastName" autoComplete="family-name" required maxLength={80} error={errors.lastName} />
        </div>}
        {["signup", "login", "forgot-password"].includes(mode) &&
          <Field label="Email address" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@business.com" error={errors.email} />}
        {["reset-password", "verify-email"].includes(mode) &&
          <Field label={mode === "reset-password" ? "Reset token" : "Verification token"} name="token" autoComplete="off" required error={errors.token} />}
        {["signup", "login", "reset-password"].includes(mode) &&
          <Field label={mode === "reset-password" ? "New password" : "Password"} name="password" type="password" required autoComplete={mode === "login" ? "current-password" : "new-password"} maxLength={128} error={errors.password} hint={mode === "login" ? undefined : "At least 12 characters. A unique passphrase works well."} />}
        {["signup", "reset-password"].includes(mode) &&
          <Field label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" required maxLength={128} error={errors.confirmPassword} />}
      </fieldset>
      {mode === "login" && <div className="text-right"><Link href="/forgot-password" className="text-sm font-medium text-teal-800 underline-offset-4 hover:underline">Forgot password?</Link></div>}
      <button className={buttonClass} disabled={busy}>{busy ? "Please wait…" : text.button}</button>
    </form>
    {["forgot-password", "reset-password", "verify-email"].includes(mode) &&
      <p className="mt-5 rounded-lg bg-slate-200/60 p-3 text-xs leading-5 text-slate-600">Email delivery is not connected yet. Reset and verification emails are unavailable. No email has been sent.</p>}
    <p className="mt-7 text-center text-sm text-slate-600">
      {mode === "login" ? <>New here? <Link className="font-semibold text-teal-800" href="/signup">Create an account</Link></> :
        <>Already have an account? <Link className="font-semibold text-teal-800" href="/login">Sign in</Link></>}
    </p>
    {mode === "forgot-password" && <p className="mt-3 text-center text-sm"><Link href="/reset-password" className="text-teal-800">I have a reset token</Link></p>}
  </AuthShell>;
}
