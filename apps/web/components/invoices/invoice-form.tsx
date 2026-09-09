"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../parties/parties.module.css";
import { listProducts, type Product } from "../../lib/catalogue";
import { customersApi, type PartyRow, moneyText } from "../../lib/parties";
import { previewInvoice, saveInvoice, type Invoice, type InvoiceInput } from "../../lib/invoices";

const today = () => new Date().toISOString().slice(0, 10);
type Line = { productId: string; quantity: string; unitPrice: string; discountType: "NONE" | "PERCENT" | "AMOUNT"; discountValue: string };

export function InvoiceForm({ id, initial }: { id?: string; initial?: Invoice }) {
  const router = useRouter();
  const [customers, setCustomers] = useState<PartyRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [placeState, setPlaceState] = useState(initial?.placeOfSupplyState ?? "");
  const [placeCode, setPlaceCode] = useState(initial?.placeOfSupplyStateCode ?? "");
  const [invoiceDate, setInvoiceDate] = useState(initial?.invoiceDate ?? today());
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [priceMode, setPriceMode] = useState<"EXCLUSIVE" | "INCLUSIVE">(initial?.priceMode ?? "EXCLUSIVE");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [terms, setTerms] = useState(initial?.terms ?? "");
  const [lines, setLines] = useState<Line[]>(initial?.lines.length ? initial.lines.map((line) => ({
    productId: line.productId ?? "",
    quantity: line.quantity.replace(/\.?0+$/, "") || "0",
    unitPrice: line.unitPrice,
    discountType: line.discountType,
    discountValue: line.discountValue,
  })) : [{ productId: "", quantity: "1", unitPrice: "0", discountType: "NONE", discountValue: "0" }]);
  const [preview, setPreview] = useState<Invoice | null>(initial ?? null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    const q = new URLSearchParams({ pageSize: "100", status: "active" });
    customersApi.list(q).then((r) => setCustomers(r.items));
    listProducts(q.toString()).then((r) => setProducts(r.items));
  }, []);
  useEffect(() => {
    if (!customerId && customers[0]) {
      setCustomerId(customers[0].id);
      setPlaceState(customers[0].state);
      setPlaceCode(customers[0].stateCode);
    }
  }, [customers, customerId]);
  const payload = (): InvoiceInput => ({
    customerId, placeOfSupplyState: placeState, placeOfSupplyStateCode: placeCode, invoiceDate, dueDate: dueDate || undefined, priceMode, notes, terms,
    lines: lines.filter((l) => l.productId).map((l) => ({ ...l, discountValue: l.discountValue || "0" })),
  });
  useEffect(() => {
    if (!customerId || !placeState || !placeCode || !lines.some((l) => l.productId)) return;
    const current = ++seq.current;
    const controller = new AbortController();
    previewInvoice(payload(), controller.signal).then((p) => { if (current === seq.current) setPreview(p); }).catch(() => undefined);
    return () => controller.abort();
  }, [customerId, placeState, placeCode, invoiceDate, dueDate, priceMode, notes, terms, lines]);
  const chooseProduct = (index: number, productId: string) => setLines((rows) => rows.map((line, i) => {
    if (i !== index) return line;
    const product = products.find((p) => p.id === productId);
    return { ...line, productId, unitPrice: product?.salePrice ?? line.unitPrice };
  }));
  const save = async () => {
    setSaving(true); setError("");
    try { const saved = await saveInvoice(payload(), id); router.push("/invoices/" + saved.id + "?saved=1"); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save invoice"); }
    finally { setSaving(false); }
  };
  return <main className={styles.page}>
    <div className={styles.heading}><div><p className={styles.eyebrow}>Sales invoice</p><h1>{id ? "Edit draft" : "Create invoice"}</h1><p>Totals are previewed by the API and recalculated when saved.</p></div><Link className={styles.secondary} href="/invoices">All invoices</Link></div>
    <section className={styles.panel}>
      {error && <p role="alert" className={styles.muted}>{error}</p>}
      <div className={styles.grid}>
        <label>Customer<select value={customerId} onChange={(e) => {
          const row = customers.find((c) => c.id === e.target.value); setCustomerId(e.target.value);
          if (row) { setPlaceState(row.state); setPlaceCode(row.stateCode); }
        }}><option value="">Choose customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}</select></label>
        <label>Invoice date<input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></label>
        <label>Due date<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
        <label>Price mode<select value={priceMode} onChange={(e) => setPriceMode(e.target.value as "EXCLUSIVE" | "INCLUSIVE")}><option value="EXCLUSIVE">Tax exclusive</option><option value="INCLUSIVE">Tax inclusive</option></select></label>
        <label>Place of supply<input value={placeState} onChange={(e) => setPlaceState(e.target.value)} /></label>
        <label>GST state code<input value={placeCode} onChange={(e) => setPlaceCode(e.target.value)} /></label>
      </div>
    </section>
    <section className={styles.panel}><h2>Line items</h2>{lines.map((line, index) => <div className={styles.grid} key={index}>
      <label className={styles.full}>Product or service<select value={line.productId} onChange={(e) => chooseProduct(index, e.target.value)}><option value="">Choose item</option>{products.map((p) => <option key={p.id} value={p.id}>{p.productCode} - {p.name}</option>)}</select></label>
      <label>Quantity<input value={line.quantity} inputMode="decimal" onChange={(e) => setLines((rows) => rows.map((r, i) => i === index ? { ...r, quantity: e.target.value } : r))} /></label>
      <label>Unit price<input value={line.unitPrice} inputMode="decimal" onChange={(e) => setLines((rows) => rows.map((r, i) => i === index ? { ...r, unitPrice: e.target.value } : r))} /></label>
      <label>Discount<select value={line.discountType} onChange={(e) => setLines((rows) => rows.map((r, i) => i === index ? { ...r, discountType: e.target.value as Line["discountType"] } : r))}><option value="NONE">None</option><option value="PERCENT">Percent</option><option value="AMOUNT">Amount</option></select></label>
      <label>Discount value<input value={line.discountValue} inputMode="decimal" onChange={(e) => setLines((rows) => rows.map((r, i) => i === index ? { ...r, discountValue: e.target.value } : r))} /></label>
    </div>)}
    <div className={styles.actions}><button className={styles.secondary} onClick={() => setLines((rows) => [...rows, { productId: "", quantity: "1", unitPrice: "0", discountType: "NONE", discountValue: "0" }])}>Add line</button></div></section>
    <section className={styles.panel}><h2>Totals</h2>{preview ? <dl className={styles.details}><dt>Subtotal</dt><dd>{moneyText(preview.subtotal)}</dd><dt>Discount</dt><dd>{moneyText(preview.discountTotal)}</dd><dt>Taxable</dt><dd>{moneyText(preview.taxableTotal)}</dd><dt>CGST</dt><dd>{moneyText(preview.cgstTotal)}</dd><dt>SGST</dt><dd>{moneyText(preview.sgstTotal)}</dd><dt>IGST</dt><dd>{moneyText(preview.igstTotal)}</dd><dt>Grand total</dt><dd>{moneyText(preview.grandTotal)}</dd></dl> : <p className={styles.muted}>Choose a customer and item to preview totals.</p>}</section>
    <section className={styles.panel}><div className={styles.grid}><label>Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label><label>Terms<textarea value={terms} onChange={(e) => setTerms(e.target.value)} /></label></div><div className={styles.actions}><button className={styles.button} disabled={saving} onClick={save}>{saving ? "Saving" : "Save draft"}</button><Link className={styles.secondary} href="/invoices">Cancel</Link></div></section>
  </main>;
}
