"use client";
import { useParams } from "next/navigation";
import { LoadState, useLoad } from "../../../../../components/catalogue/common";
import { BusinessDocumentForm } from "../../../../../components/business-documents/business-document-form";
import { getDocument } from "../../../../../lib/business-documents";
export default function Page() { const id = String(useParams().id); const { data, error, retry } = useLoad("purchase-bills" + id, (signal) => getDocument("purchase-bills", id, signal)); if (!data || error) return <LoadState error={error} retry={retry} />; return <BusinessDocumentForm kind="purchase-bills" id={id} initial={data} />; }
