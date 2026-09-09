import type { Metadata } from "next";
import { InvoiceDetail } from "../../../../components/invoices/invoice-detail";
export const metadata: Metadata = { title: "Invoice detail | GST Billing" };
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  return <InvoiceDetail id={(await params).id} />;
}
