import type { Metadata } from "next";
import { BusinessDocumentForm } from "../../../../components/business-documents/business-document-form";
export const metadata: Metadata = { title: "New Delivery Challan | GST Billing" };
export default function Page() { return <BusinessDocumentForm kind="delivery-challans" />; }
