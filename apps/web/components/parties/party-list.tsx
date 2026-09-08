"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  partyApi,
  partyCode,
  partyLabel,
  moneyText,
  type PartyKind,
  type PartyListResult,
} from "../../lib/parties";
import styles from "./parties.module.css";
export function PartyList({ kind }: { kind: PartyKind }) {
  const router = useRouter(),
    params = useSearchParams(),
    query = params.toString(),
    label = partyLabel(kind);
  const [result, setResult] = useState<PartyListResult | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [loaded, setLoaded] = useState("");
  const requestKey = kind + "?" + query + "#" + attempt;
  useEffect(() => {
    const abort = new AbortController();
    let alive = true;
    partyApi(kind)
      .list(new URLSearchParams(query), abort.signal)
      .then((data) => {
        if (alive) {
          setResult(data);
          setError("");
        }
      })
      .catch(() => {
        if (alive)
          setError(
            "We could not load your " +
              kind +
              ". Check the filters and try again.",
          );
      })
      .finally(() => {
        if (alive) setLoaded(requestKey);
      });
    return () => {
      alive = false;
      abort.abort();
    };
  }, [kind, query, attempt, requestKey]);
  const loading = loaded !== requestKey;
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget),
      next = new URLSearchParams();
    for (const [key, value] of data) {
      if (value) next.set(key, String(value));
    }
    next.set("page", "1");
    router.push("/" + kind + "?" + next);
  }
  function page(number: number) {
    const next = new URLSearchParams(query);
    next.set("page", String(number));
    router.push("/" + kind + "?" + next);
  }
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <div className={styles.eyebrow}>Your business relationships</div>
          <h1>{kind === "customers" ? "Customers" : "Suppliers"}</h1>
          <p>Keep contacts, tax details and opening balances organized.</p>
        </div>
        <Link className={styles.button} href={"/" + kind + "/new"}>
          Add {label.toLowerCase()}
        </Link>
      </header>
      <section className={styles.panel}>
        <h2>All {kind}</h2>
        <p className={styles.muted}>
          Showing active records by default. Opening balances are entered
          amounts, not current dues.
        </p>
        <form key={query} onSubmit={search} className={styles.filters}>
          <label>
            Search
            <input
              name="search"
              defaultValue={params.get("search") ?? ""}
              placeholder="Name, code, phone or GSTIN"
              maxLength={100}
            />
          </label>
          <label>
            Status
            <select
              name="status"
              defaultValue={params.get("status") ?? "active"}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All statuses</option>
            </select>
          </label>
          <label>
            GST registration
            <select
              name="gstRegistered"
              defaultValue={params.get("gstRegistered") ?? "all"}
            >
              <option value="all">All registrations</option>
              <option value="true">Registered</option>
              <option value="false">Not registered</option>
            </select>
          </label>
          <label>
            State
            <input
              name="state"
              defaultValue={params.get("state") ?? ""}
              placeholder="State name"
              maxLength={80}
            />
          </label>
          <label>
            Sort by
            <select
              name="sortBy"
              defaultValue={params.get("sortBy") ?? "displayName"}
            >
              <option value="displayName">Name</option>
              <option value="code">Code</option>
              <option value="createdAt">Created</option>
              <option value="updatedAt">Updated</option>
            </select>
          </label>
          <label>
            Order
            <select
              name="sortOrder"
              defaultValue={params.get("sortOrder") ?? "asc"}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
          <label>
            Rows per page
            <select
              name="pageSize"
              defaultValue={params.get("pageSize") ?? "20"}
            >
              {[20, 50, 100].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <button className={styles.secondary}>Apply filters</button>
        </form>
        {loading ? (
          <div role="status" aria-label="Loading records">
            {[1, 2, 3].map((n) => (
              <div key={n} className={styles.skeleton} />
            ))}
          </div>
        ) : error ? (
          <div role="alert" className={styles.empty}>
            <p>{error}</p>
            <button
              className={styles.secondary}
              onClick={() => setAttempt((n) => n + 1)}
            >
              Try again
            </button>
          </div>
        ) : result?.items.length ? (
          <table className={styles.table}>
            <caption className="sr-only">{label} directory</caption>
            <thead>
              <tr>
                {[
                  label,
                  "Contact",
                  "GST / State",
                  "Opening balance",
                  "Status",
                  "Actions",
                ].map((t) => (
                  <th key={t} scope="col">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.items.map((row) => (
                <tr key={row.id}>
                  <td data-label={label}>
                    <Link href={"/" + kind + "/" + row.id}>
                      {row.displayName}
                    </Link>
                    <small>{partyCode(row)}</small>
                  </td>
                  <td data-label="Contact">
                    <span>
                      {row.phone}
                      <small>{row.email ?? "No email"}</small>
                    </span>
                  </td>
                  <td data-label="GST / State">
                    <span>
                      {row.gstin ?? "Not GST registered"}
                      <small>{row.state}</small>
                    </span>
                  </td>
                  <td data-label="Opening">
                    <span>
                      {moneyText(row.openingBalance)}
                      <small>{row.openingBalanceType.toLowerCase()}</small>
                    </span>
                  </td>
                  <td data-label="Status">
                    <span>
                      <span
                        className={
                          styles.status +
                          " " +
                          (!row.isActive ? styles.inactive : "")
                        }
                      >
                        {row.isActive ? "Active" : "Inactive"}
                      </span>
                    </span>
                  </td>
                  <td data-label="Actions">
                    <Link
                      href={"/" + kind + "/" + row.id + "/edit"}
                      aria-label={"Edit " + row.displayName}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={styles.empty}>
            <h2>No {kind} found</h2>
            <p className={styles.muted}>
              Add your first {label.toLowerCase()} or adjust your search and
              filters.
            </p>
          </div>
        )}
        {!loading && result && !error && (
          <div className={styles.pagination}>
            <span>
              {result.total} records · Page {result.page} of{" "}
              {Math.max(1, result.totalPages)}
            </span>
            <div className={styles.actions}>
              <button
                className={styles.secondary}
                disabled={result.page <= 1}
                onClick={() => page(result.page - 1)}
              >
                Previous
              </button>
              <button
                className={styles.secondary}
                disabled={result.page >= result.totalPages}
                onClick={() => page(result.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
