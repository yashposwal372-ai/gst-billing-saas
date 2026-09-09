import type { Metadata } from "next";
import { InvoiceForm } from "../../../../components/invoices/invoice-form";
export const metadata: Metadata = { title: "Create invoice | GST Billing" };
export default function NewInvoicePage() { return <InvoiceForm />; }
