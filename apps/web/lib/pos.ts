import { z } from "zod";
import { api } from "./api";
import { invoiceSchema } from "./invoices";

const money = z.string().regex(/^\d+(\.\d{2})$/);
const qty = z.string().regex(/^\d+(\.\d{3})$/);
const productSchema = z.object({ id:z.string(), code:z.string(), name:z.string(), type:z.enum(["PRODUCT","SERVICE"]), unit:z.string(), sku:z.string().nullable(), barcode:z.string().nullable(), salePrice:money, gstRate:money, currentStock:qty, trackInventory:z.boolean(), stockStatus:z.string() });
const page = <T extends z.ZodTypeAny>(item:T)=>z.object({ items:z.array(item), page:z.number(), pageSize:z.number(), total:z.number(), totalPages:z.number() });
export const posSaleSchema = z.object({ invoiceId:z.string(), invoiceNumber:z.string().nullable(), invoiceDate:z.string(), customerId:z.string().nullable(), customerName:z.string(), itemCount:z.number(), grandTotal:money, paidAmount:money, outstanding:money, paymentStatus:z.string(), salesChannel:z.literal("POS") });
export const checkoutSchema = z.object({ invoice: invoiceSchema, payment:z.unknown().nullable(), paymentError:z.string().nullable(), changeDue:money, duplicate:z.boolean() });
export type PosProduct = z.infer<typeof productSchema>; export type PosSale = z.infer<typeof posSaleSchema>; export type PosCheckout = z.infer<typeof checkoutSchema>;
const body=(value:unknown)=>JSON.stringify(value);
export const searchPosProducts=(q:URLSearchParams,s?:AbortSignal)=>api<unknown>(`/pos/products?${q}`,{signal:s}).then(page(productSchema).parse);
export const posBarcode=(barcode:string)=>api<unknown>(`/pos/products/by-barcode/${encodeURIComponent(barcode)}`).then(z.object({profile:productSchema}).parse).then(r=>r.profile);
export const posPreview=(data:unknown,s?:AbortSignal)=>api<unknown>("/pos/preview",{method:"POST",body:body(data),signal:s}).then(invoiceSchema.parse);
export const posCheckout=(data:unknown)=>api<unknown>("/pos/checkout",{method:"POST",body:body(data)}).then(checkoutSchema.parse);
export const listPosSales=(q:URLSearchParams,s?:AbortSignal)=>api<unknown>(`/pos/sales?${q}`,{signal:s}).then(page(posSaleSchema).parse);
