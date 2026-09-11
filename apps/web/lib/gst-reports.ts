import { z } from "zod";
import { api, getApiBaseUrl } from "./api";
const money = z.string().regex(/^-?\d+\.\d{2}$/); const qty = z.string().regex(/^-?\d+\.\d{3}$/);
const totals = z.object({ taxableValue: money, cgst: money, sgst: money, igst: money, totalTax: money }).catchall(z.union([money,z.number(),z.string().nullable()]));
const scope = z.object({ financialYear: z.string().nullable(), dateFrom: z.string().nullable(), dateTo: z.string().nullable(), note: z.string() });
export const gstSummarySchema = z.object({ scope, outwardSales: totals, purchaseTaxRecorded: totals, note: z.string() });
export const salesRowSchema = z.object({ invoiceId:z.string(), invoiceNumber:z.string().nullable(), invoiceDate:z.string(), customerId:z.string().nullable(), customerName:z.string(), customerGstin:z.string().nullable(), placeOfSupply:z.string(), placeOfSupplyStateCode:z.string(), taxType:z.string(), taxableValue:money, cgst:money, sgst:money, igst:money, totalTax:money, grandTotal:money, gstinStatus:z.string() });
export const purchaseRowSchema = z.object({ purchaseBillId:z.string(), documentNumber:z.string().nullable(), supplierInvoiceNumber:z.string().nullable(), billDate:z.string(), supplierId:z.string().nullable(), supplierName:z.string(), supplierGstin:z.string().nullable(), placeOfSupply:z.string(), placeOfSupplyStateCode:z.string(), taxType:z.string(), taxableValue:money, cgst:money, sgst:money, igst:money, totalTax:money, grandTotal:money, gstinStatus:z.string() });
export const page = <T extends z.ZodTypeAny>(item:T)=>z.object({items:z.array(item),page:z.number(),pageSize:z.number(),total:z.number(),totalPages:z.number()});
export const rateSummarySchema = z.object({ items:z.array(z.object({ gstRate:money, salesTaxableValue:money, salesCgst:money, salesSgst:money, salesIgst:money, salesTax:money, purchaseTaxableValue:money, purchaseCgst:money, purchaseSgst:money, purchaseIgst:money, purchaseTax:money })) });
export const hsnSacSchema = z.object({ items:z.array(z.object({ classificationType:z.string(), code:z.string(), description:z.string(), unit:z.string(), gstRate:money, salesQuantity:qty, salesTaxableValue:money, salesTaxAmount:money, purchaseQuantity:qty, purchaseTaxableValue:money, purchaseTaxAmount:money })) });
export const placeSchema = z.object({ items:z.array(z.object({ state:z.string(), stateCode:z.string(), taxType:z.string(), invoiceCount:z.number(), taxableValue:money, cgst:money, sgst:money, igst:money, totalTax:money, grandTotal:money })) });
export const returnsSchema = z.object({ note:z.string(), salesReturns:totals, purchaseReturns:totals });
export type GstSummary=z.infer<typeof gstSummarySchema>; export type SalesRow=z.infer<typeof salesRowSchema>; export type PurchaseRow=z.infer<typeof purchaseRowSchema>;
const qs=(p:URLSearchParams)=>p.toString()?`?${p.toString()}`:"";
export async function gstSummary(p:URLSearchParams,s?:AbortSignal){return gstSummarySchema.parse(await api(`/gst-reports/summary${qs(p)}`,{signal:s}));}
export async function salesRegister(p:URLSearchParams,s?:AbortSignal){return page(salesRowSchema).parse(await api(`/gst-reports/sales-register${qs(p)}`,{signal:s}));}
export async function purchaseRegister(p:URLSearchParams,s?:AbortSignal){return page(purchaseRowSchema).parse(await api(`/gst-reports/purchase-register${qs(p)}`,{signal:s}));}
export async function outputTax(p:URLSearchParams,s?:AbortSignal){return z.object({scope,totals,note:z.string()}).parse(await api(`/gst-reports/output-tax${qs(p)}`,{signal:s}));}
export async function purchaseTax(p:URLSearchParams,s?:AbortSignal){return z.object({scope,totals,note:z.string()}).parse(await api(`/gst-reports/purchase-tax${qs(p)}`,{signal:s}));}
export async function rateSummary(p:URLSearchParams,s?:AbortSignal){return rateSummarySchema.parse(await api(`/gst-reports/gst-rate-summary${qs(p)}`,{signal:s}));}
export async function hsnSac(p:URLSearchParams,s?:AbortSignal){return hsnSacSchema.parse(await api(`/gst-reports/hsn-sac${qs(p)}`,{signal:s}));}
export async function placeOfSupply(p:URLSearchParams,s?:AbortSignal){return placeSchema.parse(await api(`/gst-reports/place-of-supply${qs(p)}`,{signal:s}));}
export async function returnsSummary(p:URLSearchParams,s?:AbortSignal){return returnsSchema.parse(await api(`/gst-reports/returns-summary${qs(p)}`,{signal:s}));}
export function exportUrl(path:string,p:URLSearchParams){return `${getApiBaseUrl()}${path}${qs(p)}`;}
