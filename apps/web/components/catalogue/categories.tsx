"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  listCategories,
  saveCategory,
  type Category,
} from "../../lib/catalogue";
import { ApiError } from "../../lib/api";
import { Field, inputClass } from "../forms/field";
import { LoadState, Modal, Pager, useLoad } from "./common";
import styles from "../parties/parties.module.css";
export function Categories() {
  const router = useRouter(),
    params = useSearchParams();
  const q = params.toString();
  const result = useLoad(q, (s) => listCategories(q, s));
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [edit, setEdit] = useState<Category | "new" | null>(null),
    [status, setStatus] = useState<Category | null>(null),
    [notice, setNotice] = useState("");
  function change(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(values)) next.set(k, v);
    if (!("page" in values)) next.delete("page");
    router.push("/categories?" + next);
  }
  const done = () => {
    setEdit(null);
    setStatus(null);
    setNotice("Category saved.");
    result.retry();
  };
  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Catalogue</p>
          <h1>Categories</h1>
          <p>Organise products and services in a flat category list.</p>
        </div>
        <button className={styles.button} onClick={() => setEdit("new")}>
          Add category
        </button>
      </div>
      {notice && <p role="status">{notice}</p>}
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
              aria-label="Search categories"
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button className={styles.secondary}>Search</button>
          <label>
            Status
            <select
              value={params.get("status") ?? "active"}
              onChange={(e) => change({ status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
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
                    <th>Category</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.items.map((c) => (
                    <tr key={c.id}>
                      <td data-label="Category">{c.name}</td>
                      <td data-label="Description">{c.description ?? "—"}</td>
                      <td data-label="Status">
                        {c.isActive ? "Active" : "Inactive"}
                      </td>
                      <td data-label="Actions">
                        <div className={styles.actions}>
                          <button
                            className={styles.secondary}
                            onClick={() => setEdit(c)}
                          >
                            Edit
                          </button>
                          <button
                            className={styles.secondary}
                            onClick={() => setStatus(c)}
                          >
                            {c.isActive ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.empty}>
                <h2>No matching categories</h2>
                <p>Create a category or adjust the filters.</p>
              </div>
            )}
            <Pager
              {...result.data}
              change={(page) => change({ page: String(page) })}
            />
          </>
        )}
      </section>
      {edit && (
        <CategoryEditor
          record={edit === "new" ? undefined : edit}
          close={() => setEdit(null)}
          done={done}
        />
      )}
      {status && (
        <CategoryStatus
          record={status}
          close={() => setStatus(null)}
          done={done}
        />
      )}
    </div>
  );
}
function CategoryEditor({
  record,
  close,
  done,
}: {
  record?: Category;
  close: () => void;
  done: () => void;
}) {
  const [name, setName] = useState(record?.name ?? ""),
    [description, setDescription] = useState(record?.description ?? ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title={record ? "Edit category" : "Add category"}
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        aria-describedby={error ? "category-editor-error" : undefined}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) {
            setError("Enter a category name.");
            return;
          }
          setBusy(true);
          setError("");
          try {
            await saveCategory(
              { name: name.trim(), description: description.trim() },
              record?.id,
            );
            done();
          } catch (e) {
            setError(
              e instanceof ApiError ? e.message : "Could not save category.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field
          autoFocus
          name="categoryName"
          id="categoryName"
          label="Category name"
          value={name}
          maxLength={120}
          required
          onChange={(e) => setName(e.target.value)}
        />
        <label>
          Description
          <textarea
            className={inputClass}
            value={description}
            maxLength={1000}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {error && <p id="category-editor-error" role="alert">{error}</p>}
        <div className={styles.actions}>
          <button className={styles.button} disabled={busy}>
            Save category
          </button>
          <button
            type="button"
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
function CategoryStatus({
  record,
  close,
  done,
}: {
  record: Category;
  close: () => void;
  done: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title={record.isActive ? "Deactivate category" : "Reactivate category"}
      close={() => {
        if (!busy) close();
      }}
    >
      <p>
        Existing products keep their category and status. Inactive categories
        cannot be assigned to new items.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions}>
        <button
          className={styles.button}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await saveCategory({ isActive: !record.isActive }, record.id);
              done();
            } catch {
              setError("Could not update category. Please retry.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Confirm
        </button>
        <button
          autoFocus
          className={styles.secondary}
          disabled={busy}
          onClick={close}
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
