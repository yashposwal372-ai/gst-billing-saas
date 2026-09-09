"use client";
import { LoadState, useLoad } from "../catalogue/common";
import { getDocument, labels, type DocumentKind } from "../../lib/business-documents";
import { moneyText } from "../../lib/parties";
import { DocumentTable } from "./business-document-detail";
import styles from "../parties/parties.module.css";
import "../invoices/invoice-print.css";

export function BusinessDocumentPrint({ kind, id }: { kind: DocumentKind; id: string }) {
  const { data, error, retry } = useLoad(kind + id, (signal)=>getDocument(kind,id,signal));
  if (!data || error) return <main className={styles.page}><LoadState error={error} retry={retry} /></main>;
  const label = labels[kind];
  return <main className={styles.page + " invoicePrint"}>{data.status === "CANCELLED" && <div className="invoiceCancelledWatermark" aria-label="Cancelled document watermark">CANCELLED</div>}<button className={styles.button + " noPrint"} onClick={()=>window.print()}>Print or save PDF</button><section className={styles.panel}><div className={styles.heading}><div><p className={styles.eyebrow}>{label.title}</p><h1>{data.documentNumber ?? "Draft"}</h1><p>{data.status}</p></div><div><strong>Date</strong><p>{data.documentDate}</p><strong>Place of supply</strong><p>{data.placeOfSupplyState} ({data.placeOfSupplyStateCode})</p></div></div><div className={styles.grid}><div><h2>Business</h2><p>{data.businessNameSnapshot}</p><p>{data.businessAddressLine1}, {data.businessCity}, {data.businessState} {data.businessPincode}</p>{data.businessGstinSnapshot && <p>GSTIN {data.businessGstinSnapshot}</p>}</div><div><h2>{label.party === "customer" ? "Customer" : "Supplier"}</h2><p>{data.partyNameSnapshot}</p><p>{data.partyAddressLine1}, {data.partyCity}, {data.partyState} {data.partyPincode}</p>{data.partyGstinSnapshot && <p>GSTIN {data.partyGstinSnapshot}</p>}</div></div></section><DocumentTable document={data} /><section className={styles.panel}><dl className={styles.details}><dt>Subtotal</dt><dd>{moneyText(data.subtotal)}</dd><dt>Discount</dt><dd>{moneyText(data.discountTotal)}</dd><dt>Taxable</dt><dd>{moneyText(data.taxableTotal)}</dd><dt>CGST</dt><dd>{moneyText(data.cgstTotal)}</dd><dt>SGST</dt><dd>{moneyText(data.sgstTotal)}</dd><dt>IGST</dt><dd>{moneyText(data.igstTotal)}</dd><dt>Grand total</dt><dd>{moneyText(data.grandTotal)}</dd></dl>{data.notes && <p>{data.notes}</p>}{data.terms && <p>{data.terms}</p>}</section></main>;
}
