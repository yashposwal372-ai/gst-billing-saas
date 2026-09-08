"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  getInventory,
  listProducts,
  listCategories,
} from "../../lib/catalogue";
import { moneyText } from "../../lib/parties";
import { LoadState, Pager, useLoad } from "./common";
import styles from "../parties/parties.module.css";
export function ProductList({ inventory = false }: { inventory?: boolean }) {
  const router = useRouter(),
    params = useSearchParams();
  const query = params.toString();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const result = useLoad(query + "-" + inventory, (s) =>
    listProducts(
      inventory
        ? new URLSearchParams({
            ...Object.fromEntries(params),
            type: "PRODUCT",
            stockStatus: params.get("stockStatus") || "tracked",
          }).toString()
        : query,
      s,
    ),
  );
  const categories = useLoad("categories", (s) =>
    listCategories("status=all&pageSize=100", s),
  );
  const summary = useLoad("inventory-" + inventory, (s) => getInventory(s));
  function change(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(values)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in values)) next.delete("page");
    router.push((inventory ? "/inventory" : "/products") + "?" + next);
  }
  const filters = [
    [
      "status",
      "Status",
      [
        ["active", "Active"],
        ["inactive", "Inactive"],
        ["all", "All"],
      ],
    ],
    ...(!inventory
      ? [
          [
            "type",
            "Type",
            [
              ["", "All types"],
              ["PRODUCT", "Products"],
              ["SERVICE", "Services"],
            ],
          ],
        ]
      : []),
    [
      "stockStatus",
      "Stock",
      [
        ["", "All stock"],
        ["tracked", "Tracked"],
        ["low", "Low stock"],
        ["out", "Out of stock"],
      ],
    ],
    [
      "sortBy",
      "Sort by",
      [
        ["name", "Name"],
        ["productCode", "Code"],
        ["createdAt", "Created"],
        ["salePrice", "Sale price"],
        ["currentStock", "Stock"],
      ],
    ],
    [
      "sortOrder",
      "Order",
      [
        ["asc", "Ascending"],
        ["desc", "Descending"],
      ],
    ],
  ] as [string, string, string[][]][];
  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Catalogue & inventory</p>
          <h1>{inventory ? "Inventory" : "Products & services"}</h1>
          <p>
            {inventory
              ? "Monitor current quantities and record explained stock adjustments."
              : "Your business catalogue, prices and stock in one place."}
          </p>
        </div>
        <Link className={styles.button} href="/products/new">
          Add product
        </Link>
      </div>
      {inventory &&
        (summary.data ? (
          <div className={styles.summary}>
            {Object.entries({
              totalActiveProducts: "Active products",
              inventoryTrackedProducts: "Inventory tracked",
              lowStockProducts: "Low stock",
              outOfStockProducts: "Out of stock",
            }).map(([k, label]) => (
              <div key={k}>
                <span>{label}</span>
                <strong>
                  {summary.data?.[k as keyof NonNullable<typeof summary.data>]}
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <LoadState error={summary.error} retry={summary.retry} />
        ))}
      {inventory && (
        <p className={styles.muted}>
          Low stock is above zero and at or below the minimum. Services are
          excluded. Stock valuation is not available.
        </p>
      )}
      <section className={styles.panel}>
        <form
          className={styles.filters}
          onSubmit={(e) => {
            e.preventDefault();
            change({ search });
          }}
        >
          <label>
            Search
            <input
              aria-label="Search products"
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, code, SKU, barcode, HSN/SAC"
            />
          </label>
          <button className={styles.secondary}>Search</button>
          {filters.map(([key, label, options]) => (
            <label key={key}>
              {label}
              <select
                value={
                  params.get(key) ??
                  (key === "stockStatus" && inventory
                    ? "tracked"
                    : options[0]![0])
                }
                onChange={(e) => change({ [key]: e.target.value })}
              >
                {options.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            Category
            <select
              value={params.get("categoryId") ?? ""}
              onChange={(e) => change({ categoryId: e.target.value })}
            >
              <option value="">All categories</option>
              {categories.data?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!c.isActive ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            GST rate
            <input
              name="gstRate"
              inputMode="decimal"
              defaultValue={params.get("gstRate") ?? ""}
              placeholder="Any rate"
              onBlur={(e) => {
                if (e.target.value !== (params.get("gstRate") ?? ""))
                  change({ gstRate: e.target.value });
              }}
            />
          </label>
        </form>
        {!result.data ? (
          <LoadState error={result.error} retry={result.retry} />
        ) : (
          <>
            {result.data.items.length ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    {[
                      "Item",
                      "Category / Type",
                      "Sale price / GST",
                      "Stock",
                      "Status",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.items.map((p) => (
                    <tr key={p.id}>
                      <td data-label="Item">
                        <Link href={"/products/" + p.id}>{p.name}</Link>
                        <small>
                          {p.productCode}
                          {p.sku ? " · " + p.sku : ""}
                        </small>
                      </td>
                      <td data-label="Category">
                        {p.category?.name ?? "Uncategorised"}
                        <small>
                          {p.type === "SERVICE" ? "Service" : "Product"}
                        </small>
                      </td>
                      <td data-label="Sale price">
                        {moneyText(p.salePrice)}
                        <small>GST {p.gstRate}%</small>
                      </td>
                      <td data-label="Stock">
                        {p.trackInventory
                          ? p.currentStock + " " + p.unit
                          : "Not tracked"}
                        <small>
                          {p.stockStatus === "low"
                            ? "Low stock"
                            : p.stockStatus === "out"
                              ? "Out of stock"
                              : ""}
                        </small>
                      </td>
                      <td data-label="Status">
                        <span
                          className={
                            p.isActive ? styles.status : styles.inactive
                          }
                        >
                          {p.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.empty}>
                <h2>No matching items</h2>
                <p>Adjust your filters or add your first product or service.</p>
                <Link href="/products/new">Add product</Link>
              </div>
            )}
            <Pager
              {...result.data}
              change={(page) => change({ page: String(page) })}
            />
          </>
        )}
      </section>
    </div>
  );
}
