import { PosReceiptPage } from "../../../../../components/pos/pos-page";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PosReceiptPage id={id}/>;}
