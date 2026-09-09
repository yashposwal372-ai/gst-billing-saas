import type { Metadata } from "next";
import { BusinessDocumentDetail } from "../../../../components/business-documents/business-document-detail";
export const metadata: Metadata = { title: "Purchase Bill detail | GST Billing" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <BusinessDocumentDetail kind="purchase-bills" id={(await params).id} />; }
