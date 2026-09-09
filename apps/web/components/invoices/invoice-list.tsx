"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../parties/parties.module.css";
import { useLoad, LoadState, Pager } from "../catalogue/common";
import { listInvoices } from "../../lib/invoices";
import { moneyText } from "../../lib/parties";

export function InvoiceList() {
  const params = useSearchParams();
  const router = useRouter();
  const query = new URLSearchParams(params);
  if (!query.get("page")) query.set("page", "1");
  const key = query.toString();
  const { data, error, retry } = useLoad(key, (signal) => listInvoices(query, signal));
  const change = (updates: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(updates).forEach(([k, v]) => v ? next.set(k, v) : next.delete(k));
    if (!("page" in updates)) next.set("page", "1");
    router.push("/invoices?" + next);
  };
  return <main className={styles.page}>
    <div className={styles.heading}><div><p className={styles.eyebrow}>Sales</p><h1>Invoices</h1><p>Draft, finalize, cancel and print sales invoices.</p></div><Link className={styles.button} href="/invoices/new">Create invoice</Link></div>
    <div className={styles.filters}>
      <label>Search<input defaultValue={params.get("search") ?? ""} onBlur={(e) => change({ search: e.target.value })} /></label>
      <label>Status<select defaultValue={params.get("status") ?? "all"} onChange={(e) => change({ status: e.target.value })}><option value="all">All</option><option value="draft">Draft</option><option value="finalized">Finalized</option><option value="cancelled">Cancelled</option></select></label>
      <label>Sort<select defaultValue={params.get("sortBy") ?? "invoiceDate"} onChange={(e) => change({ sortBy: e.target.value })}><option value="invoiceDate">Date</option><option value="invoiceNumber">Number</option><option value="grandTotal">Total</option><option value="createdAt">Created</option></select></label>
    </div>
    {!data || error ? <LoadState error={error} retry={retry} /> : data.total === 0 ? <section className={styles.empty}><h2>No invoices yet</h2><p className={styles.muted}>Create a draft invoice to begin Phase 6 billing.</p></section> : <>
      <table className={styles.table}><thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Supply</th><th>Total</th><th>Status</th></tr></thead><tbody>{data.items.map((row) => <tr key={row.id}>
        <td data-label="Invoice"><Link href={"/invoices/" + row.id}>{row.invoiceNumber ?? "Draft"}</Link></td>
        <td data-label="Customer">{row.customerNameSnapshot}</td>
        <td data-label="Date">{row.invoiceDate}</td>
        <td data-label="Supply">{row.placeOfSupplyStateCode}</td>
        <td data-label="Total">{moneyText(row.grandTotal)}</td>
        <td data-label="Status"><span className={row.status === "CANCELLED" ? styles.inactive + " " + styles.status : styles.status}>{row.status}</span></td>
      </tr>)}</tbody></table>
      <Pager page={data.page} pageSize={data.pageSize} total={data.total} change={(page) => change({ page: String(page) })} />
    </>}
  </main>;
}
