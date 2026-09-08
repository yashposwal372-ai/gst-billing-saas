"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field, FormMessage, inputClass } from "../forms/field";
import { fieldErrors } from "../../lib/form-schemas";
import { ApiError } from "../../lib/api";
import {
  partyApi,
  partyLabel,
  partyDefaults,
  partyFormSchema,
  formValues,
  type PartyKind,
  type PartyFormValues,
  type PartyProfile,
} from "../../lib/parties";
import { useParty } from "./use-party";
import { useWorkspace } from "../workspace/workspace-provider";
import styles from "./parties.module.css";
export function PartyFormPage({ kind, id }: { kind: PartyKind; id?: string }) {
  const { profile, error, loading, retry } = useParty(kind, id);
  if (loading)
    return (
      <div
        role="status"
        aria-label="Loading form"
        className={styles.skeleton}
      />
    );
  if (id && error)
    return (
      <div role="alert" className={styles.panel}>
        <p>{error}</p>
        <button className={styles.secondary} onClick={retry}>
          Try again
        </button>
      </div>
    );
  if (id && !profile) return null;
  return (
    <PartyForm key={id ?? "new"} kind={kind} profile={profile ?? undefined} />
  );
}
function PartyForm({
  kind,
  profile,
}: {
  kind: PartyKind;
  profile?: PartyProfile;
}) {
  const router = useRouter(),
    workspace = useWorkspace(),
    label = partyLabel(kind);
  const [values, setValues] = useState<PartyFormValues>(() =>
    profile ? formValues(kind, profile) : partyDefaults(kind),
  );
  const [errors, setErrors] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change<K extends keyof PartyFormValues>(
    key: K,
    value: PartyFormValues[K],
  ) {
    setValues((old) => ({ ...old, [key]: value }));
    setDirty(true);
  }
  const field = (
    key: keyof PartyFormValues,
    title: string,
    required = false,
    type = "text",
  ) => (
    <Field
      key={key}
      name={key}
      label={title}
      required={required}
      type={type}
      value={String(values[key])}
      error={errors[key]}
      onChange={(e) =>
        change(
          key,
          key === "paymentTermsDays"
            ? Number(e.target.value)
            : ["gstin", "pan", "ifsc"].includes(key)
              ? e.target.value.toUpperCase()
              : e.target.value,
        )
      }
    />
  );
  const select = (
    key: "customerType" | "openingBalanceType",
    title: string,
    options: string[],
  ) => (
    <Field name={key} label={title} error={errors[key]}>
      <select
        id={key}
        name={key}
        className={inputClass}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? key + "-error" : undefined}
        value={values[key]}
        onChange={(e) =>
          change(key, e.target.value as PartyFormValues[typeof key])
        }
      >
        {options.map((v) => (
          <option key={v} value={v}>
            {v.charAt(0) + v.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
    </Field>
  );
  const check = (
    key: "gstRegistered" | "shippingSameAsBilling",
    title: string,
  ) => (
    <label className={styles.check}>
      <input
        type="checkbox"
        checked={values[key]}
        onChange={(e) => change(key, e.target.checked)}
      />
      {title}
    </label>
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const parsed = partyFormSchema(kind).safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(),
      );
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const payload = { ...parsed.data };
      if ("shippingSameAsBilling" in payload && payload.shippingSameAsBilling) {
        Object.assign(payload, {
          shippingAddressLine1: "",
          shippingAddressLine2: "",
          shippingCity: "",
          shippingState: "",
          shippingStateCode: "",
          shippingPincode: "",
        });
      }
      const result = await partyApi(kind).save(payload, profile?.id);
      setDirty(false);
      workspace.retry();
      router.push("/" + kind + "/" + result.profile.id + "?saved=1");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status < 500
          ? err.message
          : "Unable to save this record. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const back = "/" + kind + (profile ? "/" + profile.id : "");
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <div className={styles.eyebrow}>{label} directory</div>
          <h1>
            {profile ? "Edit" : "New"} {label.toLowerCase()}
          </h1>
          <p>Accurate details today make future billing easier.</p>
        </div>
        <Link
          href={back}
          className={styles.secondary}
          onClick={(e) => {
            if (dirty && !window.confirm("Discard unsaved changes?"))
              e.preventDefault();
          }}
        >
          Cancel
        </Link>
      </header>
      <form onSubmit={submit} noValidate>
        <fieldset disabled={busy} className="min-w-0">
          {error && <FormMessage>{error}</FormMessage>}
          <section className={styles.panel}>
            <h2>Basic information</h2>
            <div className={styles.grid}>
              {field("displayName", "Display name", true)}
              {kind === "customers" &&
                select("customerType", "Customer type", [
                  "INDIVIDUAL",
                  "BUSINESS",
                ])}
              {field("businessName", "Business name")}
              {field("contactPerson", "Contact person")}
              {field("phone", "Phone", true, "tel")}
              {field("whatsappNumber", "WhatsApp number", false, "tel")}
              {field("email", "Email", false, "email")}
            </div>
          </section>
          <section className={styles.panel}>
            <h2>GST / tax information</h2>
            <p className={styles.muted}>
              Format checks only. GST registration is not verified with the
              government.
            </p>
            {check("gstRegistered", "GST registered")}
            <div className={styles.grid}>
              {field("gstin", "GSTIN", values.gstRegistered)}
              {field("pan", "PAN")}
            </div>
          </section>
          <section className={styles.panel}>
            <h2>{kind === "customers" ? "Billing address" : "Address"}</h2>
            <div className={styles.grid}>
              {field("addressLine1", "Address line 1", true)}
              {field("addressLine2", "Address line 2")}
              {field("city", "City", true)}
              {field("state", "State / union territory", true)}
              {field("stateCode", "GST state code", true)}
              {field("pincode", "Pincode", true)}
            </div>
          </section>
          {kind === "customers" && (
            <section className={styles.panel}>
              <h2>Shipping address</h2>
              {check("shippingSameAsBilling", "Same as billing address")}
              {!values.shippingSameAsBilling && (
                <div className={styles.grid}>
                  {field(
                    "shippingAddressLine1",
                    "Shipping address line 1",
                    true,
                  )}
                  {field("shippingAddressLine2", "Shipping address line 2")}
                  {field("shippingCity", "Shipping city", true)}
                  {field("shippingState", "Shipping state", true)}
                  {field("shippingStateCode", "Shipping state code", true)}
                  {field("shippingPincode", "Shipping pincode", true)}
                </div>
              )}
            </section>
          )}
          <section className={styles.panel}>
            <h2>Payment terms & opening balance</h2>
            <p className={styles.muted}>
              Enter amounts in INR. Opening balance is recorded separately; it
              is not a calculated outstanding balance. Receivable means they owe
              you; payable means you owe them.
            </p>
            <div className={styles.grid}>
              {field(
                "paymentTermsDays",
                "Payment terms (days)",
                true,
                "number",
              )}
              {field("openingBalance", "Opening balance (INR)", true)}
              {select("openingBalanceType", "Opening balance direction", [
                "RECEIVABLE",
                "PAYABLE",
              ])}
              {kind === "customers" &&
                field("creditLimit", "Credit limit (INR)")}
            </div>
          </section>
          {kind === "suppliers" && (
            <section className={styles.panel}>
              <h2>Bank details</h2>
              <p className={styles.muted}>
                Optional. Complete all four bank fields together. Account
                ownership is not verified.
              </p>
              <div className={styles.grid}>
                {field("bankName", "Bank name")}
                {field("accountHolderName", "Account holder name")}
                {field("accountNumber", "Account number")}
                {field("ifsc", "IFSC")}
                {field("upiId", "UPI ID")}
              </div>
            </section>
          )}
          <section className={styles.panel}>
            <h2>Notes</h2>
            <Field name="notes" label="Internal notes" error={errors.notes}>
              <textarea
                name="notes"
                id="notes"
                className={inputClass}
                rows={4}
                maxLength={2000}
                value={values.notes}
                aria-invalid={Boolean(errors.notes)}
                aria-describedby={errors.notes ? "notes-error" : undefined}
                onChange={(e) => change("notes", e.target.value)}
              />
            </Field>
          </section>
          <div className={styles.actions}>
            <button className={styles.button} disabled={busy}>
              {busy ? "Saving…" : "Save " + label.toLowerCase()}
            </button>
            <span className={styles.muted}>
              {dirty ? "You have unsaved changes." : ""}
            </span>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
