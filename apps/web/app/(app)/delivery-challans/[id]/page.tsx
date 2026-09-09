import type { Metadata } from "next";
import { BusinessDocumentDetail } from "../../../../components/business-documents/business-document-detail";
export const metadata: Metadata = { title: "Delivery Challan detail | GST Billing" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <BusinessDocumentDetail kind="delivery-challans" id={(await params).id} />; }
