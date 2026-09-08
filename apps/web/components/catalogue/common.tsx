"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "../parties/parties.module.css";
export function useLoad<T>(
  key: string,
  loader: (signal: AbortSignal) => Promise<T>,
) {
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>(
    { key: "" },
  );
  const [version, setVersion] = useState(0);
  const latest = useRef(loader);
  useEffect(() => {
    latest.current = loader;
  });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    latest
      .current(controller.signal)
      .then((data) => {
        if (active) setState({ key, data });
      })
      .catch(() => {
        if (active)
          setState({
            key,
            error: "Could not load this information. Please try again.",
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [key, version]);
  return {
    data: state.key === key ? state.data : undefined,
    error: state.key === key ? state.error : undefined,
    retry: () => {
      setState({ key: "" });
      setVersion((v) => v + 1);
    },
  };
}
export function LoadState({
  error,
  retry,
}: {
  error?: string;
  retry: () => void;
}) {
  return error ? (
    <div className={styles.panel} role="alert">
      <p>{error}</p>
      <button className={styles.secondary} onClick={retry}>
        Try again
      </button>
    </div>
  ) : (
    <div role="status" className={styles.panel}>
      Loading…
      <div className={styles.skeleton} />
    </div>
  );
}
export function Pager({
  page,
  pageSize,
  total,
  change,
}: {
  page: number;
  pageSize: number;
  total: number;
  change: (page: number) => void;
}) {
  return (
    <div className={styles.pagination}>
      <span>
        {total} records · Page {page} of{" "}
        {Math.max(1, Math.ceil(total / pageSize))}
      </span>
      <div className={styles.actions}>
        <button
          className={styles.secondary}
          disabled={page <= 1}
          onClick={() => change(page - 1)}
        >
          Previous
        </button>
        <button
          className={styles.secondary}
          disabled={page * pageSize >= total}
          onClick={() => change(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
export function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={styles.dialog}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const nodes = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
          ),
        ).filter((n) => n.getClientRects().length);
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
    >
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
