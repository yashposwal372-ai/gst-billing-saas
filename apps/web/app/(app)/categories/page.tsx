import {Suspense} from "react";
import {Categories} from "../../../components/catalogue/categories";
export default function Page(){return <Suspense fallback={<p>Loading categories…</p>}><Categories/></Suspense>;}
