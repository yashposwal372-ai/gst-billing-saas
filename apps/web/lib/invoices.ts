import { z } from "zod";
import { api } from "./api";
import { paged } from "./catalogue";

const money = z.string().regex(/^\d+(\.\d{2})$/);
const qty = z.string().regex(/^\d+(\.\d{3})$/);
const paymentHistorySchema = z.object({ paymentId: z.string().optional(), paymentNumber: z.string().nullable().optional(), paymentDate: z.string().nullable().optional(), amount: money, method: z.string().optional(), status: z.string().optional(), account: z.object({ id: z.string(), accountCode: z.string(), name: z.string(), type: z.string() }).nullable().optional() });
const settlementSchema = z.object({ paymentStatus: z.enum(["UNAVAILABLE","UNPAID","PARTIAL","PAID"]), paidAmount: money, outstanding: money, paymentHistory: z.array(paymentHistorySchema) }).optional();

export const invoiceLineInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.string().regex(/^(0|[1-9]\d{0,14})(\.\d{1,3})?$/),
  unitPrice: z.string().regex(/^(0|[1-9]\d{0,12})(\.\d{1,2})?$/),
  discountType: z.enum(["NONE", "PERCENT", "AMOUNT"]),
  discountValue: z.string().optional(),
});

export const invoiceInputSchema = z.object({
  customerId: z.string().uuid(),
  placeOfSupplyState: z.string().min(2),
  placeOfSupplyStateCode: z.string().regex(/^(0[1-9]|[12][0-9]|3[0-8])$/),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().optional(),
  priceMode: z.enum(["EXCLUSIVE", "INCLUSIVE"]),
  notes: z.string().optional(),
  terms: z.string().optional(),
  lines: z.array(invoiceLineInputSchema).min(1),
});
export type InvoiceInput = z.infer<typeof invoiceInputSchema>;

export const invoiceLineSchema = z.object({
  id: z.string().nullable().optional(),
  productId: z.string().nullable(),
  lineNumber: z.number(),
  productCodeSnapshot: z.string().nullable(),
  productNameSnapshot: z.string(),
  productTypeSnapshot: z.enum(["PRODUCT", "SERVICE"]),
  hsnSacCodeSnapshot: z.string().nullable(),
  unitSnapshot: z.string(),
  quantity: qty,
  unitPrice: money,
  priceMode: z.enum(["EXCLUSIVE", "INCLUSIVE"]),
  discountType: z.enum(["NONE", "PERCENT", "AMOUNT"]),
  discountValue: money,
  discountAmount: money,
  grossAmount: money,
  taxableAmount: money,
  gstRate: money,
  cgstRate: money,
  cgstAmount: money,
  sgstRate: money,
  sgstAmount: money,
  igstRate: money,
  igstAmount: money,
  taxAmount: money,
  lineTotal: money,
});

export const invoiceSchema = z.object({
  id: z.string().nullable(),
  status: z.enum(["DRAFT", "FINALIZED", "CANCELLED"]),
  invoiceNumber: z.string().nullable(),
  customerId: z.string().nullable(),
  financialYear: z.string(),
  invoiceDate: z.string(),
  dueDate: z.string().nullable().optional(),
  placeOfSupplyState: z.string(),
  placeOfSupplyStateCode: z.string(),
  priceMode: z.enum(["EXCLUSIVE", "INCLUSIVE"]),
  customerNameSnapshot: z.string(),
  customerCodeSnapshot: z.string().nullable(),
  customerGstinSnapshot: z.string().nullable(),
  billingAddressLine1: z.string(),
  billingCity: z.string(),
  billingState: z.string(),
  billingPincode: z.string(),
  sellerBusinessName: z.string(),
  sellerLegalName: z.string().nullable(),
  sellerGstin: z.string().nullable(),
  sellerAddressLine1: z.string(),
  sellerCity: z.string(),
  sellerState: z.string(),
  sellerPincode: z.string(),
  subtotal: money,
  discountTotal: money,
  taxableTotal: money,
  cgstTotal: money,
  sgstTotal: money,
  igstTotal: money,
  taxTotal: money,
  roundOff: money,
  grandTotal: money,
  cancellationReason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  lines: z.array(invoiceLineSchema),
  settlement: settlementSchema,
});
export type Invoice = z.infer<typeof invoiceSchema>;

export const invoiceListItemSchema = z.object({
  id: z.string(),
  status: z.enum(["DRAFT", "FINALIZED", "CANCELLED"]),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string(),
  customerNameSnapshot: z.string(),
  placeOfSupplyStateCode: z.string(),
  grandTotal: money,
});

export async function listInvoices(q: URLSearchParams, signal?: AbortSignal) {
  return paged(invoiceListItemSchema).parse(await api("/invoices?" + q, { signal }));
}
export async function getInvoice(id: string, signal?: AbortSignal) {
  return invoiceSchema.parse((await api("/invoices/" + id, { signal }) as { profile: unknown }).profile);
}
export async function previewInvoice(input: InvoiceInput, signal?: AbortSignal) {
  return invoiceSchema.parse(await api("/invoices/preview", { method: "POST", body: JSON.stringify(input), signal }));
}
export async function saveInvoice(input: InvoiceInput, id?: string) {
  return invoiceSchema.parse((await api("/invoices" + (id ? "/" + id : ""), { method: id ? "PATCH" : "POST", body: JSON.stringify(input) }) as { profile: unknown }).profile);
}
export async function finalizeInvoice(id: string) {
  return invoiceSchema.parse((await api("/invoices/" + id + "/finalize", { method: "POST" }) as { profile: unknown }).profile);
}
export async function cancelInvoice(id: string, reason: string) {
  return invoiceSchema.parse((await api("/invoices/" + id + "/cancel", { method: "POST", body: JSON.stringify({ reason }) }) as { profile: unknown }).profile);
}
export async function discardInvoice(id: string) {
  return api("/invoices/" + id, { method: "DELETE" });
}
