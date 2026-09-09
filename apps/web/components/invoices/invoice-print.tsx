"use client";
import styles from "../parties/parties.module.css";
import { LoadState, useLoad } from "../catalogue/common";
import { getInvoice } from "../../lib/invoices";
import { InvoiceTable } from "./invoice-detail";
import { moneyText } from "../../lib/parties";
import "./invoice-print.css";

export function InvoicePrint({ id }: { id: string }) {
  const { data, error, retry } = useLoad(id, (signal) => getInvoice(id, signal));
  if (!data || error) return <main className={styles.page}><LoadState error={error} retry={retry} /></main>;
  return <main className={styles.page + " invoicePrint"}>
    {data.status === "CANCELLED" && <div className="invoiceCancelledWatermark" aria-label="Cancelled invoice watermark">CANCELLED</div>}
    <button className={styles.button + " noPrint"} onClick={() => window.print()}>Print or save PDF</button>
    <section className={styles.panel}>
      <div className={styles.heading}><div><p className={styles.eyebrow}>Tax invoice</p><h1>{data.invoiceNumber ?? "Draft"}</h1><p>{data.status}</p></div><div><strong>Date</strong><p>{data.invoiceDate}</p><strong>Place of supply</strong><p>{data.placeOfSupplyState} ({data.placeOfSupplyStateCode})</p></div></div>
      <div className={styles.grid}><div><h2>Seller</h2><p>{data.sellerBusinessName}</p><p>{data.sellerAddressLine1}, {data.sellerCity}, {data.sellerState} {data.sellerPincode}</p>{data.sellerGstin && <p>GSTIN {data.sellerGstin}</p>}</div><div><h2>Customer</h2><p>{data.customerNameSnapshot}</p><p>{data.billingAddressLine1}, {data.billingCity}, {data.billingState} {data.billingPincode}</p>{data.customerGstinSnapshot && <p>GSTIN {data.customerGstinSnapshot}</p>}</div></div>
    </section>
    <InvoiceTable invoice={data} />
    <section className={styles.panel}><dl className={styles.details}><dt>Subtotal</dt><dd>{moneyText(data.subtotal)}</dd><dt>Discount</dt><dd>{moneyText(data.discountTotal)}</dd><dt>Taxable value</dt><dd>{moneyText(data.taxableTotal)}</dd><dt>CGST</dt><dd>{moneyText(data.cgstTotal)}</dd><dt>SGST</dt><dd>{moneyText(data.sgstTotal)}</dd><dt>IGST</dt><dd>{moneyText(data.igstTotal)}</dd><dt>Grand total</dt><dd>{moneyText(data.grandTotal)}</dd></dl>{data.notes && <p>{data.notes}</p>}{data.terms && <p>{data.terms}</p>}</section>
  </main>;
}
