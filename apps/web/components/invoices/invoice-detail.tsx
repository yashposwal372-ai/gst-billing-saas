"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import styles from "../parties/parties.module.css";
import { LoadState, Modal, useLoad } from "../catalogue/common";
import { cancelInvoice, discardInvoice, finalizeInvoice, getInvoice, type Invoice } from "../../lib/invoices";
import { moneyText } from "../../lib/parties";

export function InvoiceDetail({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { data, error, retry } = useLoad(id + params.toString(), (signal) => getInvoice(id, signal));
  const [action, setAction] = useState<"finalize" | "cancel" | "discard" | null>(null);
  if (!data || error) return <main className={styles.page}><LoadState error={error} retry={retry} /></main>;
  return <main className={styles.page}>
    <div className={styles.heading}><div><p className={styles.eyebrow}>Invoice</p><h1>{data.invoiceNumber ?? "Draft"}</h1><p>{data.customerNameSnapshot} · {data.invoiceDate}</p></div><div className={styles.actions}><Link className={styles.secondary} href="/invoices">All invoices</Link>{data.status === "DRAFT" && <Link className={styles.secondary} href={"/invoices/" + id + "/edit"}>Edit</Link>}{data.status !== "DRAFT" && <Link className={styles.button} href={"/invoices/" + id + "/print"}>Print</Link>}</div></div>
    <section className={styles.panel}><span className={data.status === "CANCELLED" ? styles.inactive + " " + styles.status : styles.status}>{data.status}</span><dl className={styles.details}><dt>Place of supply</dt><dd>{data.placeOfSupplyState} ({data.placeOfSupplyStateCode})</dd><dt>Financial year</dt><dd>{data.financialYear}</dd><dt>Seller</dt><dd>{data.sellerBusinessName}{data.sellerGstin ? "\nGSTIN " + data.sellerGstin : ""}</dd><dt>Customer</dt><dd>{data.customerNameSnapshot}{data.customerGstinSnapshot ? "\nGSTIN " + data.customerGstinSnapshot : ""}</dd>{data.cancellationReason && <><dt>Cancellation reason</dt><dd>{data.cancellationReason}</dd></>}</dl></section>
    <InvoiceTable invoice={data} />
    <section className={styles.panel}><h2>Totals</h2><dl className={styles.details}><dt>Subtotal</dt><dd>{moneyText(data.subtotal)}</dd><dt>Discount</dt><dd>{moneyText(data.discountTotal)}</dd><dt>Taxable value</dt><dd>{moneyText(data.taxableTotal)}</dd><dt>CGST</dt><dd>{moneyText(data.cgstTotal)}</dd><dt>SGST</dt><dd>{moneyText(data.sgstTotal)}</dd><dt>IGST</dt><dd>{moneyText(data.igstTotal)}</dd><dt>Tax total</dt><dd>{moneyText(data.taxTotal)}</dd><dt>Grand total</dt><dd>{moneyText(data.grandTotal)}</dd></dl></section>
    <section className={styles.panel}><div className={styles.actions}>{data.status === "DRAFT" && <><button className={styles.button} onClick={() => setAction("finalize")}>Finalize invoice</button><button className={styles.secondary} onClick={() => setAction("discard")}>Discard draft</button></>}{data.status === "FINALIZED" && <button className={styles.secondary} onClick={() => setAction("cancel")}>Cancel invoice</button>}</div></section>
    {action && <InvoiceAction action={action} id={id} close={() => setAction(null)} done={(next) => { setAction(null); if (next) { router.replace("/invoices/" + next.id); retry(); } else router.replace("/invoices"); }} />}
  </main>;
}

export function InvoiceTable({ invoice }: { invoice: Invoice }) {
  return <section className={styles.panel}><h2>Line items</h2><table className={styles.table}><thead><tr><th>Item</th><th>HSN/SAC</th><th>Qty</th><th>Rate</th><th>Discount</th><th>Tax</th><th>Total</th></tr></thead><tbody>{invoice.lines.map((line) => <tr key={line.lineNumber}><td data-label="Item">{line.productNameSnapshot}<small>{line.productCodeSnapshot}</small></td><td data-label="HSN/SAC">{line.hsnSacCodeSnapshot ?? "—"}</td><td data-label="Qty">{line.quantity} {line.unitSnapshot}</td><td data-label="Rate">{moneyText(line.unitPrice)}</td><td data-label="Discount">{moneyText(line.discountAmount)}</td><td data-label="Tax">{moneyText(line.taxAmount)}<small>GST {line.gstRate}%</small></td><td data-label="Total">{moneyText(line.lineTotal)}</td></tr>)}</tbody></table></section>;
}

function InvoiceAction({ action, id, close, done }: { action: "finalize" | "cancel" | "discard"; id: string; close: () => void; done: (invoice?: Invoice) => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const run = async () => {
    setError("");
    try {
      if (action === "finalize") done(await finalizeInvoice(id));
      else if (action === "cancel") done(await cancelInvoice(id, reason));
      else { await discardInvoice(id); done(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed"); }
  };
  return <Modal title={action === "finalize" ? "Finalize invoice" : action === "cancel" ? "Cancel invoice" : "Discard draft"} close={close}>
    <p>{action === "finalize" ? "A permanent invoice number will be assigned, stock will be deducted, and financial details will become immutable." : action === "cancel" ? "Stock from this finalized invoice will be restored once, and the invoice will remain preserved as cancelled." : "This draft has not affected stock or numbering and will be removed."}</p>
    {action === "cancel" && <label>Cancellation reason<textarea value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
    {error && <p role="alert">{error}</p>}
    <div className={styles.actions}><button className={styles.button} onClick={run}>{action === "finalize" ? "Finalize" : action === "cancel" ? "Cancel invoice" : "Discard"}</button><button className={styles.secondary} onClick={close}>Keep invoice</button></div>
  </Modal>;
}
