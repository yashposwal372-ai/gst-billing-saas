"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadState, Pager, useLoad } from "../catalogue/common";
import styles from "../parties/parties.module.css";
import { type DocumentKind, labels, listDocuments } from "../../lib/business-documents";
import { moneyText } from "../../lib/parties";

export function BusinessDocumentList({ kind }: { kind: DocumentKind }) {
  const params = useSearchParams(); const router = useRouter(); const query = new URLSearchParams(params); if (!query.get("page")) query.set("page", "1");
  const { data, error, retry } = useLoad(kind + query.toString(), (signal) => listDocuments(kind, query, signal));
  const change = (updates: Record<string,string>) => { const next = new URLSearchParams(params); Object.entries(updates).forEach(([k,v]) => v ? next.set(k,v) : next.delete(k)); if (!("page" in updates)) next.set("page","1"); router.push("/" + kind + "?" + next); };
  const label = labels[kind];
  return <main className={styles.page}><div className={styles.heading}><div><p className={styles.eyebrow}>{label.party === "customer" ? "Sales" : "Purchases"}</p><h1>{label.title}</h1><p>Server-calculated GST documents with explicit lifecycle controls.</p></div><Link className={styles.button} href={`/${kind}/new`}>Create</Link></div>
    <div className={styles.filters}><label>Search<input defaultValue={params.get("search") ?? ""} onBlur={(e)=>change({search:e.target.value})} /></label><label>Status<select defaultValue={params.get("status") ?? "all"} onChange={(e)=>change({status:e.target.value})}><option value="all">All</option><option value="draft">Draft</option><option value="issued">Issued</option><option value="confirmed">Confirmed</option><option value="finalized">Finalized</option><option value="cancelled">Cancelled</option></select></label></div>
    {!data || error ? <LoadState error={error} retry={retry} /> : data.total === 0 ? <section className={styles.empty}><h2>No documents yet</h2><p className={styles.muted}>Create the first {label.title.toLowerCase()} document.</p></section> : <><table className={styles.table}><thead><tr><th>Document</th><th>Party</th><th>Date</th><th>FY</th><th>Total</th><th>Status</th></tr></thead><tbody>{data.items.map((row)=><tr key={row.id}><td data-label="Document"><Link href={`/${kind}/${row.id}`}>{row.documentNumber ?? "Draft"}</Link>{row.supplierInvoiceNumber && <small>Supplier bill {row.supplierInvoiceNumber}</small>}</td><td data-label="Party">{row.partyNameSnapshot}</td><td data-label="Date">{row.documentDate}</td><td data-label="FY">{row.financialYear}</td><td data-label="Total">{moneyText(row.grandTotal)}</td><td data-label="Status"><span className={row.status === "CANCELLED" ? styles.inactive + " " + styles.status : styles.status}>{row.status}</span></td></tr>)}</tbody></table><Pager page={data.page} pageSize={data.pageSize} total={data.total} change={(page)=>change({page:String(page)})} /></>}
  </main>;
}
