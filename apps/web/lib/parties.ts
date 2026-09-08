import { z } from "zod";
import { api } from "./api";
import { businessFields } from "./form-schemas";
export type PartyKind = "customers" | "suppliers";
export const partyLabel = (kind: PartyKind) =>
  kind === "customers" ? "Customer" : "Supplier";
const optional = (max: number) => z.string().trim().max(max);
const money = z
  .string()
  .regex(
    /^(0|[1-9]\d{0,12})(\.\d{1,2})?$/,
    "Use a nonnegative amount with up to 2 decimal places",
  );
const baseFields = z.object({
  displayName: z.string().trim().min(2).max(160),
  businessName: optional(160),
  contactPerson: optional(160),
  gstRegistered: z.boolean(),
  gstin: businessFields.shape.gstin,
  pan: businessFields.shape.pan,
  phone: businessFields.shape.mobile,
  whatsappNumber: z
    .string()
    .refine(
      (v) => !v || businessFields.shape.mobile.safeParse(v).success,
      "Enter a valid phone number",
    ),
  email: z
    .string()
    .trim()
    .refine(
      (v) => !v || z.email().max(254).safeParse(v).success,
      "Enter a valid email",
    ),
  addressLine1: businessFields.shape.addressLine1,
  addressLine2: businessFields.shape.addressLine2,
  city: businessFields.shape.city,
  state: businessFields.shape.state,
  stateCode: businessFields.shape.stateCode,
  pincode: businessFields.shape.pincode,
  openingBalance: money,
  openingBalanceType: z.enum(["RECEIVABLE", "PAYABLE"]),
  paymentTermsDays: z.number().int().min(0).max(3650),
  notes: optional(2000),
  isActive: z.boolean(),
});
const customerFields = baseFields.extend({
  customerType: z.enum(["INDIVIDUAL", "BUSINESS"]),
  shippingSameAsBilling: z.boolean(),
  shippingAddressLine1: optional(200),
  shippingAddressLine2: optional(200),
  shippingCity: optional(80),
  shippingState: optional(80),
  shippingStateCode: z.string(),
  shippingPincode: z.string(),
  creditLimit: z
    .string()
    .refine(
      (v) => !v || money.safeParse(v).success,
      "Enter a nonnegative decimal amount",
    ),
});
const supplierFields = baseFields.extend({
  bankName: businessFields.shape.bankName,
  accountHolderName: businessFields.shape.accountHolder,
  accountNumber: businessFields.shape.accountNumber,
  ifsc: businessFields.shape.ifsc,
  upiId: businessFields.shape.upiId,
});
export function partyFormSchema(kind: PartyKind) {
  return (kind === "customers" ? customerFields : supplierFields).superRefine(
    (data, ctx) => {
      const issue = (key: string, message: string) =>
        ctx.addIssue({ code: "custom", path: [key], message });
      if (data.gstRegistered) {
        if (!data.gstin) issue("gstin", "GSTIN is required");
        else if (data.gstin.slice(0, 2) !== data.stateCode)
          issue("gstin", "GSTIN state code must match the address");
        if (data.pan && data.gstin.slice(2, 12) !== data.pan)
          issue("pan", "PAN must match GSTIN");
      } else if (data.gstin) issue("gstin", "Clear GSTIN for a non-GST party");
      if ("shippingSameAsBilling" in data && !data.shippingSameAsBilling) {
        for (const [field, schema] of Object.entries({
          shippingAddressLine1: businessFields.shape.addressLine1,
          shippingCity: businessFields.shape.city,
          shippingState: businessFields.shape.state,
          shippingStateCode: businessFields.shape.stateCode,
          shippingPincode: businessFields.shape.pincode,
        })) {
          if (!schema.safeParse(data[field as keyof typeof data]).success)
            issue(field, "Enter a valid shipping address value");
        }
      }
      if ("bankName" in data) {
        const bank = [
          data.bankName,
          data.accountHolderName,
          data.accountNumber,
          data.ifsc,
        ];
        if (bank.some(Boolean) && !bank.every(Boolean))
          issue(
            "bankName",
            "Complete all four bank fields or leave them empty",
          );
      }
    },
  );
}
export type PartyFormValues = z.infer<typeof customerFields> &
  z.infer<typeof supplierFields>;
export const partyDefaults = (kind: PartyKind): PartyFormValues => ({
  displayName: "",
  businessName: "",
  contactPerson: "",
  gstRegistered: false,
  gstin: "",
  pan: "",
  phone: "",
  whatsappNumber: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  stateCode: "",
  pincode: "",
  openingBalance: "0.00",
  openingBalanceType: kind === "customers" ? "RECEIVABLE" : "PAYABLE",
  paymentTermsDays: 0,
  notes: "",
  isActive: true,
  customerType: "INDIVIDUAL",
  shippingSameAsBilling: true,
  shippingAddressLine1: "",
  shippingAddressLine2: "",
  shippingCity: "",
  shippingState: "",
  shippingStateCode: "",
  shippingPincode: "",
  creditLimit: "",
  bankName: "",
  accountHolderName: "",
  accountNumber: "",
  ifsc: "",
  upiId: "",
});
const rowSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  businessName: z.string().nullable(),
  phone: z.string(),
  email: z.string().nullable(),
  gstRegistered: z.boolean(),
  gstin: z.string().nullable(),
  state: z.string(),
  stateCode: z.string(),
  openingBalance: money,
  openingBalanceType: z.enum(["RECEIVABLE", "PAYABLE"]),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  customerCode: z.string().optional(),
  supplierCode: z.string().optional(),
});
const profileSchema = rowSchema.extend({
  contactPerson: z.string().nullable(),
  pan: z.string().nullable(),
  whatsappNumber: z.string().nullable(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string(),
  pincode: z.string(),
  paymentTermsDays: z.number(),
  notes: z.string().nullable(),
  customerType: z.enum(["INDIVIDUAL", "BUSINESS"]).optional(),
  shippingSameAsBilling: z.boolean().optional(),
  shippingAddressLine1: z.string().nullable().optional(),
  shippingAddressLine2: z.string().nullable().optional(),
  shippingCity: z.string().nullable().optional(),
  shippingState: z.string().nullable().optional(),
  shippingStateCode: z.string().nullable().optional(),
  shippingPincode: z.string().nullable().optional(),
  creditLimit: money.nullable().optional(),
  bankName: z.string().nullable().optional(),
  accountHolderName: z.string().nullable().optional(),
  accountNumber: z.string().nullable().optional(),
  ifsc: z.string().nullable().optional(),
  upiId: z.string().nullable().optional(),
});
export type PartyRow = z.infer<typeof rowSchema>;
export type PartyProfile = z.infer<typeof profileSchema>;
const listSchema = z.object({
  items: z.array(rowSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
export type PartyListResult = z.infer<typeof listSchema>;
export const partyApi = (kind: PartyKind) => ({
  list: async (query: URLSearchParams, signal?: AbortSignal) =>
    listSchema.parse(await api("/" + kind + "?" + query, { signal })),
  detail: async (id: string, signal?: AbortSignal) =>
    z
      .object({
        profile: profileSchema,
        summary: z.record(z.string(), z.null()),
        dataStatus: z.literal("not_available"),
        ledgerEntries: z.array(z.never()),
        activity: z.array(z.never()),
      })
      .parse(await api("/" + kind + "/" + encodeURIComponent(id), { signal })),
  save: async (data: unknown, id?: string) =>
    z
      .object({ profile: profileSchema })
      .parse(
        await api("/" + kind + (id ? "/" + encodeURIComponent(id) : ""), {
          method: id ? "PATCH" : "POST",
          body: JSON.stringify(data),
        }),
      ),
  deactivate: async (id: string) =>
    z
      .object({ profile: profileSchema })
      .parse(
        await api("/" + kind + "/" + encodeURIComponent(id), {
          method: "DELETE",
        }),
      ),
});
export const customersApi = partyApi("customers");
export const suppliersApi = partyApi("suppliers");
export function formValues(
  kind: PartyKind,
  profile: PartyProfile,
): PartyFormValues {
  const values = partyDefaults(kind);
  for (const key of Object.keys(values)) {
    const value = profile[key as keyof PartyProfile];
    if (value !== undefined) Object.assign(values, { [key]: value ?? "" });
  }
  return values;
}
export function partyCode(row: PartyRow) {
  return row.customerCode ?? row.supplierCode ?? "";
}
export function moneyText(value: string) {
  const [whole, fraction = "00"] = value.split(".");
  return (
    "₹" +
    whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    "." +
    fraction.padEnd(2, "0")
  );
}
