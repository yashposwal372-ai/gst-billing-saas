import type { Metadata } from "next";
import { BusinessDocumentPrint } from "../../../../../components/business-documents/business-document-print";
export const metadata: Metadata = { title: "Print Delivery Challan | GST Billing" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <BusinessDocumentPrint kind="delivery-challans" id={(await params).id} />; }
