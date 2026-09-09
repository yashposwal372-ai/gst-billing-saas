import { z } from "zod";
import { api } from "./api";
export const units = [
  "PCS",
  "NOS",
  "KG",
  "G",
  "LTR",
  "ML",
  "MTR",
  "BOX",
  "PACK",
  "SET",
  "HOUR",
  "DAY",
  "SERVICE",
] as const;
export const money = z
  .string()
  .regex(
    /^(0|[1-9]\d{0,12})(\.\d{1,2})?$/,
    "Use a nonnegative amount with up to 2 decimal places",
  );
export const quantity = z
  .string()
  .regex(
    /^(0|[1-9]\d{0,14})(\.\d{1,3})?$/,
    "Use a nonnegative quantity with up to 3 decimal places",
  );
export const productFields = z
  .object({
    name: z.string().trim().min(1, "Enter an item name").max(160),
    description: z.string().trim().max(2000),
    type: z.enum(["PRODUCT", "SERVICE"]),
    unit: z.enum(units),
    categoryId: z.union([z.uuid(), z.literal("")]),
    sku: z.string().trim().max(80),
    barcode: z.string().trim().max(100),
    hsnSacCode: z.string().trim(),
    gstRate: z
      .string()
      .regex(
        /^(0|[1-9]\d?)(\.\d{1,2})?$|^100(\.0{1,2})?$/,
        "Enter a rate from 0 to 100 with up to 2 decimals",
      ),
    purchasePrice: money,
    salePrice: money,
    mrp: z.union([money, z.literal("")]),
    trackInventory: z.boolean(),
    openingStock: quantity,
    minimumStock: z.union([quantity, z.literal("")]),
    isActive: z.boolean(),
  })
  .superRefine((v, c) => {
    if (v.type === "SERVICE" && v.trackInventory)
      c.addIssue({
        code: "custom",
        path: ["trackInventory"],
        message: "Services cannot track inventory",
      });
    if (
      !v.trackInventory &&
      (!/^0(\.0+)?$/.test(v.openingStock) || v.minimumStock !== "")
    )
      c.addIssue({
        code: "custom",
        path: ["openingStock"],
        message: "Stock fields require inventory tracking",
      });
    if (
      v.hsnSacCode &&
      !(v.type === "SERVICE" ? /^99\d{4}$/ : /^(\d{4}|\d{6}|\d{8})$/).test(
        v.hsnSacCode,
      )
    )
      c.addIssue({
        code: "custom",
        path: ["hsnSacCode"],
        message:
          "Products: 4, 6 or 8 digits. Services: 6 digits starting with 99.",
      });
  });
export type ProductFields = z.infer<typeof productFields>;
export const productDefaults: ProductFields = {
  name: "",
  description: "",
  type: "PRODUCT",
  unit: "PCS",
  categoryId: "",
  sku: "",
  barcode: "",
  hsnSacCode: "",
  gstRate: "0",
  purchasePrice: "0",
  salePrice: "0",
  mrp: "",
  trackInventory: false,
  openingStock: "0",
  minimumStock: "",
  isActive: true,
};
export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Category = z.infer<typeof categorySchema>;
export const productSchema = z.object({
  id: z.string(),
  productCode: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: z.enum(["PRODUCT", "SERVICE"]),
  unit: z.enum(units),
  categoryId: z.string().nullable(),
  category: z
    .object({ id: z.string(), name: z.string(), isActive: z.boolean() })
    .nullable()
    .optional(),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  hsnSacCode: z.string().nullable(),
  gstRate: money,
  purchasePrice: money,
  salePrice: money,
  mrp: money.nullable(),
  trackInventory: z.boolean(),
  openingStock: quantity,
  currentStock: quantity,
  minimumStock: quantity.nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  stockStatus: z.enum(["not_tracked", "available", "low", "out"]),
});
export type Product = z.infer<typeof productSchema>;
export const paged = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number(),
    pageSize: z.number(),
  });
export const movementSchema = z.object({
  id: z.string(),
  productId: z.string(),
  type: z.enum([
    "OPENING",
    "ADJUSTMENT_IN",
    "ADJUSTMENT_OUT",
    "INVOICE_FINALIZED",
    "INVOICE_CANCELLED",
    "PURCHASE_BILL_FINALIZED",
    "PURCHASE_BILL_CANCELLED",
    "SALES_RETURN_FINALIZED",
    "SALES_RETURN_CANCELLED",
    "PURCHASE_RETURN_FINALIZED",
    "PURCHASE_RETURN_CANCELLED",
  ]),
  quantity,
  beforeStock: quantity,
  afterStock: quantity,
  reason: z.string(),
  createdById: z.string(),
  createdAt: z.string(),
});
export const summarySchema = z.object({
  totalActiveProducts: z.number(),
  inventoryTrackedProducts: z.number(),
  lowStockProducts: z.number(),
  outOfStockProducts: z.number(),
});
export const listProducts = async (q: string, signal?: AbortSignal) =>
  paged(productSchema).parse(await api("/products?" + q, { signal }));
export const getProduct = async (id: string, signal?: AbortSignal) =>
  z
    .object({ profile: productSchema })
    .parse(await api("/products/" + id, { signal })).profile;
export const saveProduct = async (data: Partial<ProductFields>, id?: string) =>
  z
    .object({ profile: productSchema })
    .parse(
      await api("/products" + (id ? "/" + id : ""), {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(data),
      }),
    ).profile;
export const listCategories = async (q: string, signal?: AbortSignal) =>
  paged(categorySchema).parse(await api("/categories?" + q, { signal }));
export const saveCategory = async (
  data: { name?: string; description?: string; isActive?: boolean },
  id?: string,
) =>
  z
    .object({ profile: categorySchema })
    .parse(
      await api("/categories" + (id ? "/" + id : ""), {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(data),
      }),
    ).profile;
export const getInventory = async (signal?: AbortSignal) =>
  summarySchema.parse(await api("/inventory/summary", { signal }));
export const movements = async (id: string, q: string, signal?: AbortSignal) =>
  paged(movementSchema).parse(
    await api("/products/" + id + "/stock-movements?" + q, { signal }),
  );
export const adjustStock = async (
  id: string,
  data: {
    direction: "INCREASE" | "DECREASE";
    quantity: string;
    reason: string;
  },
) =>
  z
    .object({ profile: productSchema, movement: movementSchema })
    .parse(
      await api("/products/" + id + "/stock-adjustments", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    );
export function editValues(p: Product): ProductFields {
  return {
    ...productDefaults,
    ...p,
    description: p.description ?? "",
    categoryId: p.categoryId ?? "",
    sku: p.sku ?? "",
    barcode: p.barcode ?? "",
    hsnSacCode: p.hsnSacCode ?? "",
    mrp: p.mrp ?? "",
    minimumStock: p.minimumStock ?? "",
    openingStock: "0",
  };
}
