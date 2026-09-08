import {Suspense} from "react";
import {ProductList} from "../../../components/catalogue/product-list";
export default function Page(){return <Suspense fallback={<p>Loading inventory…</p>}><ProductList inventory/></Suspense>;}
