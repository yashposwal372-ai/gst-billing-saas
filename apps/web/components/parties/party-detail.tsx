"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  partyApi,
  partyCode,
  partyLabel,
  moneyText,
  type PartyKind,
} from "../../lib/parties";
import { useParty } from "./use-party";
import { useWorkspace } from "../workspace/workspace-provider";
import { FormMessage } from "../forms/field";
import styles from "./parties.module.css";
export function PartyDetail({ kind, id }: { kind: PartyKind; id: string }) {
  const { profile, error, loading, retry } = useParty(kind, id),
    workspace = useWorkspace(),
    params = useSearchParams();
  const [tab, setTab] = useState("Overview"),
    [busy, setBusy] = useState(false),
    [mutationError, setMutationError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    label = partyLabel(kind);
  async function toggle() {
    if (!profile) return;
    setBusy(true);
    setMutationError("");
    try {
      if (profile.isActive) await partyApi(kind).deactivate(id);
      else await partyApi(kind).save({ isActive: true }, id);
      dialog.current?.close();
      retry();
      workspace.retry();
    } catch {
      setMutationError("We could not change the status. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div
        role="status"
        aria-label="Loading record"
        className={styles.skeleton}
      />
    );
  if (error || !profile)
    return (
      <div className={styles.panel} role="alert">
        <p>{error || "Record unavailable"}</p>
        <button className={styles.secondary} onClick={retry}>
          Try again
        </button>
        <Link href={"/" + kind}>Back to {kind}</Link>
      </div>
    );
  const info = (title: string, value: string | null | undefined) => (
    <div key={title}>
      <dt>{title}</dt>
      <dd>{value || "Not provided"}</dd>
    </div>
  );
  const address = [
    profile.addressLine1,
    profile.addressLine2,
    profile.city,
    profile.state + " (" + profile.stateCode + ")",
    profile.pincode,
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <Link className={styles.eyebrow} href={"/" + kind}>
            ← {kind}
          </Link>
          <h1>{profile.displayName}</h1>
          <p>
            {partyCode(profile)} ·{" "}
            <span className={styles.status}>
              {profile.isActive ? "Active" : "Inactive"}
            </span>
          </p>
        </div>
        <div className={styles.actions}>
          <Link
            className={styles.secondary}
            href={"/" + kind + "/" + id + "/edit"}
          >
            Edit {label.toLowerCase()}
          </Link>
          <button
            ref={trigger}
            className={styles.secondary}
            onClick={() => {
              setMutationError("");
              dialog.current?.showModal();
            }}
          >
            {profile.isActive ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      </header>
      {params.get("saved") === "1" && (
        <FormMessage success>{label} saved successfully.</FormMessage>
      )}
      <div className={styles.summary}>
        {(kind === "customers"
          ? ["Total sales", "Paid", "Outstanding", "Invoices"]
          : ["Total purchases", "Paid", "Payable", "Purchases"]
        ).map((t) => (
          <div key={t}>
            <span className={styles.muted}>{t}</span>
            <strong aria-label="Not available">—</strong>
            <small className={styles.muted}>
              Available with future modules
            </small>
          </div>
        ))}
      </div>
      <div className={styles.tabs} aria-label="Record sections">
        {(kind === "customers"
          ? [
              "Overview",
              "Invoices",
              "Payments",
              "Ledger",
              "Returns",
              "Activity",
            ]
          : ["Overview", "Purchases", "Payments", "Ledger", "Activity"]
        ).map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab !== "Overview" ? (
        <section className={styles.panel}>
          <h2>{tab}</h2>
          <p className={styles.muted}>
            No {tab.toLowerCase()} entries available. This section will be
            available after the relevant billing or payment module is enabled.
            No transactions have been created from the opening balance.
          </p>
        </section>
      ) : (
        <>
          <section className={styles.panel}>
            <h2>Contact & tax details</h2>
            <dl className={styles.details}>
              {info("Business name", profile.businessName)}
              {info("Contact person", profile.contactPerson)}
              {info("Phone", profile.phone)}
              {info("WhatsApp", profile.whatsappNumber)}
              {info("Email", profile.email)}
              {info(
                "GST registration",
                profile.gstRegistered
                  ? "Registered (not verified)"
                  : "Not registered",
              )}
              {info("GSTIN", profile.gstin)}
              {info("PAN", profile.pan)}
              {kind === "customers" &&
                info("Customer type", profile.customerType)}
            </dl>
          </section>
          <section className={styles.panel}>
            <h2>Addresses</h2>
            <dl className={styles.details}>
              {info(
                kind === "customers" ? "Billing address" : "Address",
                address,
              )}
              {kind === "customers" &&
                info(
                  "Shipping address",
                  profile.shippingSameAsBilling
                    ? "Same as billing address"
                    : [
                        profile.shippingAddressLine1,
                        profile.shippingAddressLine2,
                        profile.shippingCity,
                        profile.shippingState,
                        profile.shippingStateCode,
                        profile.shippingPincode,
                      ]
                        .filter(Boolean)
                        .join("\n"),
                )}
            </dl>
          </section>
          <section className={styles.panel}>
            <h2>Payment terms & opening balance</h2>
            <dl className={styles.details}>
              {info("Payment terms", profile.paymentTermsDays + " days")}
              {info(
                "Opening balance",
                moneyText(profile.openingBalance) +
                  " " +
                  profile.openingBalanceType.toLowerCase(),
              )}
              {kind === "customers" &&
                info(
                  "Credit limit",
                  profile.creditLimit ? moneyText(profile.creditLimit) : null,
                )}
            </dl>
            <p className={styles.muted}>
              Opening balance is an entered starting amount, not a live
              outstanding or payable total.
            </p>
          </section>
          {kind === "suppliers" && (
            <section className={styles.panel}>
              <h2>Bank details</h2>
              <dl className={styles.details}>
                {info("Bank name", profile.bankName)}
                {info("Account holder", profile.accountHolderName)}
                {info(
                  "Account number",
                  profile.accountNumber
                    ? "•••• " + profile.accountNumber.slice(-4)
                    : null,
                )}
                {info("IFSC", profile.ifsc)}
                {info("UPI ID", profile.upiId)}
              </dl>
              <p className={styles.muted}>
                Account details are not bank-verified. Authorized editing
                displays the full stored account number.
              </p>
            </section>
          )}
          <section className={styles.panel}>
            <h2>Notes</h2>
            <p
              className={styles.muted}
              style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
            >
              {profile.notes || "No notes added."}
            </p>
          </section>
        </>
      )}
      <dialog
        ref={dialog}
        onClose={() => trigger.current?.focus()}
        className={styles.dialog}
        aria-labelledby="status-title"
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            const buttons = Array.from(
              e.currentTarget.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              ),
            );
            const first = buttons[0],
              last = buttons[buttons.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <h2 id="status-title">
          {profile.isActive ? "Deactivate" : "Reactivate"} {label.toLowerCase()}
          ?
        </h2>
        <p>
          {profile.isActive
            ? "This record will be hidden from the Active list. Its details will be retained, and you can reactivate it later."
            : "This record will appear in the Active list again."}
        </p>
        {mutationError && <FormMessage>{mutationError}</FormMessage>}
        <div className={styles.actions}>
          <button
            autoFocus
            className={styles.secondary}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button
            className={styles.button}
            disabled={busy}
            onClick={() => void toggle()}
          >
            {busy
              ? "Updating…"
              : "Confirm " +
                (profile.isActive ? "deactivation" : "reactivation")}
          </button>
        </div>
      </dialog>
    </div>
  );
}
