"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  getProduct,
  listCategories,
  saveProduct,
  productFields,
  productDefaults,
  editValues,
  units,
  type ProductFields,
} from "../../lib/catalogue";
import { ApiError } from "../../lib/api";
import { useWorkspace } from "../workspace/workspace-provider";
import { Field, inputClass } from "../forms/field";
import { LoadState, useLoad } from "./common";
import styles from "../parties/parties.module.css";
export function ProductForm({ id }: { id?: string }) {
  const result = useLoad(id ?? "new", async (s) =>
    id ? getProduct(id, s) : null,
  );
  if (result.data === undefined)
    return <LoadState error={result.error} retry={result.retry} />;
  return (
    <Editor
      key={id ?? "new"}
      id={id}
      initial={result.data ? editValues(result.data) : productDefaults}
    />
  );
}
function Editor({ id, initial }: { id?: string; initial: ProductFields }) {
  const router = useRouter();
  const workspace = useWorkspace();
  const [values, setValues] = useState(initial),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const categories = useLoad("category-options", (s) =>
    listCategories("status=all&pageSize=100", s),
  );
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  function set<K extends keyof ProductFields>(key: K, value: ProductFields[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const parsed = productFields.safeParse(values);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        fields[String(issue.path[0])] = issue.message;
      setErrors(fields);
      document.getElementById(Object.keys(fields)[0] ?? "name")?.focus();
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const data: Partial<ProductFields> = { ...parsed.data };
      if (id) delete data.openingStock;
      const saved = await saveProduct(data, id);
      workspace.retry();
      router.push("/products/" + saved.id + "?saved=1");
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Could not save this item. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const textField = (
    key: keyof ProductFields,
    label: string,
    extra: Record<string, unknown> = {},
  ) => (
    <Field
      key={key}
      name={key}
      id={key}
      label={label}
      error={errors[key]}
      value={String(values[key])}
      onChange={(e) => set(key, e.target.value as never)}
      {...extra}
    />
  );
  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Catalogue</p>
          <h1>{id ? "Edit item" : "Add product or service"}</h1>
          <p>
            Prices are entered in INR. Tax codes and rates are format checked,
            not government verified.
          </p>
        </div>
        <Link href="/products">Back to products</Link>
      </div>
      <form onSubmit={submit} noValidate>
        <section className={styles.panel}>
          <h2>Item details</h2>
          <div className={styles.grid}>
            {textField("name", "Item name", { required: true, maxLength: 160 })}
            <label>
              Type
              <select
                id="type"
                className={inputClass}
                disabled={!!id}
                value={values.type}
                onChange={(e) => {
                  const type = e.target.value as ProductFields["type"];
                  setValues((v) => ({
                    ...v,
                    type,
                    unit: type === "SERVICE" ? "SERVICE" : "PCS",
                    trackInventory: false,
                    openingStock: "0",
                    minimumStock: "",
                    hsnSacCode: "",
                  }));
                }}
              >
                <option value="PRODUCT">Product</option>
                <option value="SERVICE">Service</option>
              </select>
            </label>
            <label>
              Category
              <select
                id="categoryId"
                aria-invalid={Boolean(errors.categoryId)}
                aria-describedby={errors.categoryId ? "categoryId-error" : undefined}
                className={inputClass}
                value={values.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
              >
                <option value="">Uncategorised</option>
                {categories.data?.items
                  .filter((c) => c.isActive || c.id === values.categoryId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {!c.isActive ? " (inactive)" : ""}
                    </option>
                  ))}
              </select>
              {errors.categoryId && (
                <span id="categoryId-error" role="alert">{errors.categoryId}</span>
              )}
              {categories.error && (
                <button type="button" onClick={categories.retry}>
                  Retry categories
                </button>
              )}
              <Link href="/categories">Manage categories</Link>
            </label>
            <label>
              Unit
              <select
                id="unit"
                className={inputClass}
                disabled={!!id}
                value={values.unit}
                onChange={(e) =>
                  set("unit", e.target.value as ProductFields["unit"])
                }
              >
                {units.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
            {textField("sku", "SKU", { maxLength: 80 })}
            {textField("barcode", "Barcode", { maxLength: 100 })}
            {textField(
              "hsnSacCode",
              values.type === "SERVICE" ? "SAC code" : "HSN code",
              { maxLength: 8, inputMode: "numeric" },
            )}
            <label className={styles.full}>
              Description
              <textarea
                id="description"
                className={inputClass}
                maxLength={2000}
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </label>
          </div>
        </section>
        <section className={styles.panel}>
          <h2>Pricing & tax</h2>
          <div className={styles.grid}>
            {textField("purchasePrice", "Purchase price", {
              inputMode: "decimal",
            })}
            {textField("salePrice", "Sale price", { inputMode: "decimal" })}
            {textField("mrp", "MRP (optional)", { inputMode: "decimal" })}
            {textField("gstRate", "GST rate (%)", { inputMode: "decimal" })}
          </div>
        </section>
        <section className={styles.panel}>
          <h2>Inventory</h2>
          <p className={styles.muted}>
            {id
              ? "Type, unit and tracking are fixed after creation. Change stock through an adjustment on the item detail page."
              : "Opening stock is recorded once with an immutable movement. Quantities support up to 3 decimal places."}
          </p>
          <label className={styles.check}>
            <input
              id="trackInventory"
              type="checkbox"
              checked={values.trackInventory}
              disabled={!!id || values.type === "SERVICE"}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  trackInventory: e.target.checked,
                  openingStock: "0",
                  minimumStock: "",
                }))
              }
            />
            Track inventory
          </label>
          {values.type === "SERVICE" && (
            <p className={styles.muted}>Services have no stock.</p>
          )}
          {values.trackInventory && (
            <div className={styles.grid}>
              {!id &&
                textField("openingStock", "Opening stock", {
                  inputMode: "decimal",
                })}
              {textField("minimumStock", "Minimum stock (optional)", {
                inputMode: "decimal",
              })}
            </div>
          )}
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={values.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
            />
            Active item
          </label>
        </section>
        {error && <p role="alert">{error}</p>}
        <div className={styles.actions}>
          <button className={styles.button} disabled={busy}>
            {busy ? "Saving…" : "Save item"}
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            onClick={() => {
              if (!dirty || window.confirm("Discard unsaved changes?"))
                router.push(id ? "/products/" + id : "/products");
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
