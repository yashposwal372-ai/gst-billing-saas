import {ProductDetail} from "../../../../components/catalogue/product-detail";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ProductDetail id={id}/>;}
