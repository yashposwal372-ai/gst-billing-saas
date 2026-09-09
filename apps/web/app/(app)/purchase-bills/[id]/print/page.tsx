import type { Metadata } from "next";
import { BusinessDocumentPrint } from "../../../../../components/business-documents/business-document-print";
export const metadata: Metadata = { title: "Print Purchase Bill | GST Billing" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <BusinessDocumentPrint kind="purchase-bills" id={(await params).id} />; }
