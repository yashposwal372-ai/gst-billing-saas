import {PartyFormPage} from "../../../../../components/parties/party-form";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PartyFormPage kind="suppliers" id={id}/>;}
