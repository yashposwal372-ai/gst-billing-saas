"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../auth/auth-provider";
import { api } from "../../lib/api";
import { businessFields, businessSchema, fieldErrors, type Business } from "../../lib/form-schemas";
import { Field, FormMessage, buttonClass, inputClass } from "../forms/field";

const stepFields = [
  ["name", "tradeName", "ownerName", "businessType", "mobile", "email", "addressLine1", "addressLine2", "state", "stateCode", "city", "pincode"],
  ["gstRegistered", "gstin", "pan"],
  ["invoicePrefix", "financialYear", "gstMode", "bankName", "accountHolder", "accountNumber", "ifsc", "upiId"],
];
const sections = ["Business details", "GST information", "Invoice & bank setup"];
function initialValues(): Record<string, string> {
  const date = new Date();
  const year = date.getMonth() < 3 ? date.getFullYear() - 1 : date.getFullYear();
  return { name: "", tradeName: "", ownerName: "", businessType: "PROPRIETORSHIP", mobile: "", email: "",
    addressLine1: "", addressLine2: "", state: "", stateCode: "", city: "", pincode: "",
    gstRegistered: "no", gstin: "", pan: "", invoicePrefix: "INV",
    financialYear: year + "-" + String((year + 1) % 100).padStart(2, "0"), gstMode: "NOT_APPLICABLE",
    bankName: "", accountHolder: "", accountNumber: "", ifsc: "", upiId: "" };
}
export function OnboardingForm() {
  const auth = useAuth(); const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [step, setStep] = useState(0); const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true); const [editing, setEditing] = useState(false);
  const [error, setError] = useState(""); const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    api<{ business: Business | null }>("/businesses/current").then(({ business }) => {
      if (!alive) return;
      if (business) {
        setEditing(true);
        setValues((previous) => Object.fromEntries(Object.keys(previous).map((key) => [
          key, key === "gstRegistered" ? business.gstRegistered ? "yes" : "no" : String(business[key as keyof Business] ?? ""),
        ])));
      } else {
        setValues((previous) => ({ ...previous, email: auth.user?.email ?? "", ownerName: [auth.user?.firstName, auth.user?.lastName].filter(Boolean).join(" ") }));
      }
    }).catch((err: unknown) => { if (alive) setError(err instanceof Error ? err.message : "Unable to load your business"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [auth.user?.id, auth.user?.email, auth.user?.firstName, auth.user?.lastName]);
  function change(name: string, value: string) {
    setValues((previous) => {
      const next = { ...previous, [name]: ["gstin", "pan", "ifsc", "invoicePrefix"].includes(name) ? value.toUpperCase() : value };
      if (name === "gstRegistered") {
        next.gstMode = value === "yes" ? "EXCLUSIVE" : "NOT_APPLICABLE";
        if (value === "no") next.gstin = "";
      }
      return next;
    });
  }
  const field = (name: string, label: string, required = true, hint?: string, type = "text") =>
    <Field key={name} name={name} label={label} required={required} hint={hint} type={type} value={values[name] ?? ""}
      onChange={(event) => change(name, event.target.value)} error={errors[name]} />;
  const select = (name: string, label: string, options: [string, string][]) =>
    <Field name={name} label={label} required error={errors[name]}><select name={name} id={name} value={values[name]} onChange={(event) => change(name, event.target.value)}
      className={inputClass} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? name + "-error" : undefined}>
      {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
    </select></Field>;
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    const data = { ...values, gstRegistered: values.gstRegistered === "yes" };
    if (step < 2) {
      const parsed = businessFields.safeParse(data);
      const relevant = parsed.success ? {} : Object.fromEntries(Object.entries(fieldErrors(parsed.error)).filter(([key]) => stepFields[step]!.includes(key)));
      if (step === 1 && data.gstRegistered && !values.gstin) relevant.gstin = "GSTIN is required";
      if (Object.keys(relevant).length) { setErrors(relevant); return; }
      setErrors({}); setStep(step + 1); return;
    }
    const parsed = businessSchema.safeParse(data);
    if (!parsed.success) {
      const nextErrors = fieldErrors(parsed.error); setErrors(nextErrors);
      const first = stepFields.findIndex((fields) => fields.some((key) => nextErrors[key]));
      if (first >= 0) setStep(first);
      return;
    }
    setErrors({}); setBusy(true);
    try {
      await api(editing ? "/businesses/current" : "/businesses", { method: editing ? "PATCH" : "POST", body: JSON.stringify(parsed.data) });
      await auth.refreshUser(); router.replace("/welcome");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save your business"); }
    finally { setBusy(false); }
  }
  return <main className="min-h-dvh bg-[#f4f6f9] px-5 py-8 text-slate-900 sm:px-10">
    <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 border-b border-slate-200 pb-6">
      <span className="font-semibold tracking-tight">GST Billing <span className="font-normal text-slate-500">/ Business setup</span></span>
      <Link href={editing ? "/welcome" : "/login"} className="text-sm text-teal-800">{editing ? "Back to workspace" : "Back to sign in"}</Link>
    </header>
    <div className="mx-auto mt-10 max-w-5xl lg:grid lg:grid-cols-[240px_1fr] lg:gap-14">
      <aside>
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-800">{editing ? "Your business profile" : "Make it yours"}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{editing ? "Update your business" : "Set up your business"}</h1>
        <ol className="mb-8 mt-8 space-y-5" aria-label="Onboarding progress">
          {sections.map((section, index) => <li key={section} aria-current={step === index ? "step" : undefined} className={"flex items-center gap-3 text-sm " + (step === index ? "font-semibold text-teal-900" : "text-slate-500")}>
            <span className={"grid size-8 shrink-0 place-items-center rounded-full border " + (step >= index ? "border-teal-800 bg-teal-800 text-white" : "border-slate-300")}>{index + 1}</span>{section}
          </li>)}
        </ol>
        <p className="hidden text-xs leading-6 text-slate-500 lg:block">These details belong to your business. You can review and update them after setup.</p>
      </aside>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-semibold">{sections[step]}</h2>
        <p className="mb-7 mt-2 text-sm text-slate-500">Step {step + 1} of 3 · Fields marked * are required.</p>
        {loading ? <p role="status">Loading your business profile…</p> :
          <form onSubmit={submit} noValidate className="space-y-6">
            {error && <FormMessage>{error}</FormMessage>}
            <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
              {step === 0 && <>
                {field("name", "Business name")}{field("tradeName", "Trade name", false)}
                {field("ownerName", "Owner name")}
                {select("businessType", "Business type", [["PROPRIETORSHIP", "Proprietorship"], ["PARTNERSHIP", "Partnership"], ["LLP", "Limited liability partnership"], ["PRIVATE_LIMITED", "Private limited company"], ["OTHER", "Other"]])}
                {field("mobile", "Mobile number", true, undefined, "tel")}{field("email", "Business email", true, undefined, "email")}
                <div className="sm:col-span-2">{field("addressLine1", "Address line 1")}</div>
                <div className="sm:col-span-2">{field("addressLine2", "Address line 2", false)}</div>
                {field("state", "State / union territory")}{field("stateCode", "GST state code", true, "Two digits, for example 27 for Maharashtra.")}
                {field("city", "City")}{field("pincode", "Pincode")}
                <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500 sm:col-span-2">Business logo uploads will be available when file storage is connected.</p>
              </>}
              {step === 1 && <>
                {select("gstRegistered", "GST registered?", [["no", "No"], ["yes", "Yes"]])}
                {field("pan", "PAN", false)}
                {values.gstRegistered === "yes" && <div className="sm:col-span-2">{field("gstin", "GSTIN")}</div>}
                <p className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600 sm:col-span-2">We check the format of GSTIN and PAN only. This is not official government verification.</p>
              </>}
              {step === 2 && <>
                {field("invoicePrefix", "Invoice prefix", true, "A starting reference, for example INV.")}{field("financialYear", "Financial year", true, "Indian financial year, for example 2026-27.")}
                {values.gstRegistered === "yes" && select("gstMode", "Default GST mode", [["EXCLUSIVE", "Tax exclusive"], ["INCLUSIVE", "Tax inclusive"]])}
                <div className="mt-2 border-t border-slate-200 pt-5 sm:col-span-2"><h3 className="font-medium">Bank details <span className="text-sm font-normal text-slate-500">· Optional</span></h3><p className="mt-1 text-xs text-slate-500">Complete all four fields, or leave them empty. Details are not verified with a bank.</p></div>
                {field("bankName", "Bank name", false)}{field("accountHolder", "Account holder", false)}
                {field("accountNumber", "Account number", false)}{field("ifsc", "IFSC", false)}
                <div className="sm:col-span-2">{field("upiId", "UPI ID", false, "Optional. No payment integration is enabled.")}</div>
              </>}
            </fieldset>
            <div className="flex items-center gap-4 border-t border-slate-200 pt-6">
              {step > 0 && <button type="button" disabled={busy} onClick={() => { setStep(step - 1); setErrors({}); }} className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium">Back</button>}
              <button disabled={busy} className={buttonClass}>{busy ? "Saving…" : step < 2 ? "Continue" : editing ? "Save changes" : "Complete setup"}</button>
            </div>
          </form>}
      </section>
    </div>
  </main>;
}
