"use client";
import { useParams } from "next/navigation";
import { LoadState, useLoad } from "../../../../../components/catalogue/common";
import { InvoiceForm } from "../../../../../components/invoices/invoice-form";
import { getInvoice } from "../../../../../lib/invoices";

export default function EditInvoicePage() {
  const id = String(useParams().id);
  const { data, error, retry } = useLoad(id, (signal) => getInvoice(id, signal));
  if (!data || error) return <LoadState error={error} retry={retry} />;
  return <InvoiceForm id={id} initial={data} />;
}
