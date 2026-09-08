import {Suspense} from "react";
import {PartyDetail} from "../../../../components/parties/party-detail";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Suspense fallback={<p role="status">Loading record…</p>}><PartyDetail kind="suppliers" id={id}/></Suspense>;}
