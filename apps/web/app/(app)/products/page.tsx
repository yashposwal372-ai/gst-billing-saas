import {Suspense} from "react";
import {ProductList} from "../../../components/catalogue/product-list";
export default function Page(){return <Suspense fallback={<p>Loading products…</p>}><ProductList/></Suspense>;}
