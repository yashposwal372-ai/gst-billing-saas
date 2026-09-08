"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getProduct,
  movements,
  adjustStock,
  saveProduct,
  quantity,
  type Product,
} from "../../lib/catalogue";
import { ApiError } from "../../lib/api";
import { moneyText } from "../../lib/parties";
import { useWorkspace } from "../workspace/workspace-provider";
import { Field, inputClass } from "../forms/field";
import { LoadState, Modal, Pager, useLoad } from "./common";
import styles from "../parties/parties.module.css";
export function ProductDetail({ id }: { id: string }) {
  const result = useLoad(id, (s) => getProduct(id, s));
  const params = useSearchParams();
  const [dialog, setDialog] = useState<"stock" | "status" | null>(null),
    [notice, setNotice] = useState("");
  const workspace = useWorkspace();
  if (!result.data)
    return <LoadState error={result.error} retry={result.retry} />;
  const p = result.data;
  const details = {
    Type: p.type,
    Category: p.category?.name ?? "Uncategorised",
    SKU: p.sku ?? "—",
    Barcode: p.barcode ?? "—",
    "HSN / SAC": p.hsnSacCode ?? "—",
    "GST rate": p.gstRate + "%",
    "Purchase price": moneyText(p.purchasePrice),
    "Sale price": moneyText(p.salePrice),
    MRP: p.mrp ? moneyText(p.mrp) : "—",
    Unit: p.unit,
    "Opening stock": p.trackInventory ? p.openingStock : "Not tracked",
    "Current stock": p.trackInventory ? p.currentStock : "Not tracked",
    "Minimum stock": p.minimumStock ?? "Not set",
    Status: p.isActive ? "Active" : "Inactive",
    Description: p.description ?? "—",
  };
  const done = () => {
    setDialog(null);
    setNotice("Changes saved.");
    result.retry();
    workspace.retry();
  };
  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>{p.productCode}</p>
          <h1>{p.name}</h1>
          <p>
            {p.type === "SERVICE" ? "Service" : "Product"} ·{" "}
            {p.stockStatus === "low"
              ? "Low stock"
              : p.stockStatus === "out"
                ? "Out of stock"
                : p.isActive
                  ? "Active"
                  : "Inactive"}
          </p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.secondary} href="/products">
            All products
          </Link>
          <Link className={styles.button} href={"/products/" + id + "/edit"}>
            Edit item
          </Link>
        </div>
      </div>
      {(notice || params.has("saved")) && (
        <p role="status">{notice || "Item saved."}</p>
      )}
      <section className={styles.panel}>
        <h2>Item information</h2>
        <dl className={styles.details}>
          {Object.entries(details).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className={styles.actions}>
        {p.isActive && p.trackInventory && p.type === "PRODUCT" && (
          <button className={styles.button} onClick={() => setDialog("stock")}>
            Adjust stock
          </button>
        )}
        <button
          className={styles.secondary}
          onClick={() => setDialog("status")}
        >
          {p.isActive ? "Deactivate" : "Reactivate"}
        </button>
      </div>
      <History key={p.updatedAt + notice} id={id} />
      {dialog && (
        <Action p={p} mode={dialog} close={() => setDialog(null)} done={done} />
      )}
    </div>
  );
}
function History({ id }: { id: string }) {
  const [page, setPage] = useState(1),
    [type, setType] = useState("");
  const result = useLoad(id + page + type, (s) =>
    movements(
      id,
      new URLSearchParams({
        page: String(page),
        ...(type ? { type } : {}),
      }).toString(),
      s,
    ),
  );
  return (
    <section className={styles.panel} style={{ marginTop: 24 }}>
      <h2>Stock movement history</h2>
      <p className={styles.muted}>
        Opening stock and manual adjustments only. Recorded movements cannot be
        edited or deleted.
      </p>
      <div className={styles.filters}>
        <label>
          Movement type
          <select
            value={type}
            onChange={(e) => {
              setPage(1);
              setType(e.target.value);
            }}
          >
            <option value="">All movements</option>
            <option value="OPENING">Opening</option>
            <option value="ADJUSTMENT_IN">Increase</option>
            <option value="ADJUSTMENT_OUT">Decrease</option>
          </select>
        </label>
      </div>
      {!result.data ? (
        <LoadState error={result.error} retry={result.retry} />
      ) : (
        <>
          {result.data.items.length ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  {[
                    "When / Type",
                    "Quantity",
                    "Before / After",
                    "Reason / Actor",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((m) => (
                  <tr key={m.id}>
                    <td data-label="When">
                      {new Date(m.createdAt).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}
                      <small>{m.type.replaceAll("_", " ")} · India time</small>
                    </td>
                    <td data-label="Quantity">{m.quantity}</td>
                    <td data-label="Before / After">
                      {m.beforeStock} → {m.afterStock}
                    </td>
                    <td data-label="Reason">
                      {m.reason}
                      <small>Actor: {m.createdById}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.empty}>No stock movements recorded.</div>
          )}
          <Pager {...result.data} change={setPage} />
        </>
      )}
    </section>
  );
}
function Action({
  p,
  mode,
  close,
  done,
}: {
  p: Product;
  mode: "stock" | "status";
  close: () => void;
  done: () => void;
}) {
  const [direction, setDirection] = useState<"INCREASE" | "DECREASE">(
      "INCREASE",
    ),
    [amount, setAmount] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title={
        mode === "stock"
          ? "Adjust stock"
          : p.isActive
            ? "Deactivate item"
            : "Reactivate item"
      }
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        aria-describedby={error ? "stock-action-error" : undefined}
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          if (
            mode === "stock" &&
            (!quantity.safeParse(amount).success ||
              /^0(\.0+)?$/.test(amount) ||
              !reason.trim())
          ) {
            setError(
              "Enter a positive quantity (up to 3 decimals) and a reason.",
            );
            return;
          }
          setBusy(true);
          try {
            if (mode === "stock")
              await adjustStock(p.id, {
                direction,
                quantity: amount,
                reason: reason.trim(),
              });
            else await saveProduct({ isActive: !p.isActive }, p.id);
            done();
          } catch (e) {
            setError(
              e instanceof ApiError
                ? e.message
                : "Could not save changes. Please retry.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {mode === "stock" ? (
          <>
            <p>
              Current stock:{" "}
              <strong>
                {p.currentStock} {p.unit}
              </strong>
              . Decreases cannot exceed available stock.
            </p>
            <label>
              Direction
              <select
                autoFocus
                className={inputClass}
                value={direction}
                onChange={(e) =>
                  setDirection(e.target.value as typeof direction)
                }
              >
                <option value="INCREASE">Increase</option>
                <option value="DECREASE">Decrease</option>
              </select>
            </label>
            <Field
              name="quantity"
              id="quantity"
              label="Quantity"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <Field
              name="reason"
              id="reason"
              label="Reason"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </>
        ) : (
          <p>
            {p.isActive
              ? "This item will be hidden from active lists. Its stock and movement history remain available."
              : "This item will return to active lists."}
          </p>
        )}
        {error && <p id="stock-action-error" role="alert">{error}</p>}
        <div className={styles.actions}>
          <button className={styles.button} disabled={busy}>
            {busy ? "Saving…" : "Confirm"}
          </button>
          <button
            type="button"
            autoFocus={mode === "status"}
            className={styles.secondary}
            disabled={busy}
            onClick={close}
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
