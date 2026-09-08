import {Suspense} from "react";
import {PartyList} from "../../../components/parties/party-list";
export default function Page(){return <Suspense fallback={<p role="status">Loading directory…</p>}><PartyList kind="customers"/></Suspense>;}
