import type { Metadata } from "next";
import { BusinessDocumentList } from "../../../components/business-documents/business-document-list";
export const metadata: Metadata = { title: "Sales Returns | GST Billing" };
export default function Page() { return <BusinessDocumentList kind="sales-returns" />; }
