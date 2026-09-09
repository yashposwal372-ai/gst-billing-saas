import type { Metadata } from "next";
import { InvoicePrint } from "../../../../../components/invoices/invoice-print";
export const metadata: Metadata = { title: "Print invoice | GST Billing" };
export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  return <InvoicePrint id={(await params).id} />;
}
