import type { Metadata } from "next";
import { InvoiceList } from "../../../components/invoices/invoice-list";
export const metadata: Metadata = { title: "Invoices | GST Billing" };
export default function InvoicesPage() { return <InvoiceList />; }
