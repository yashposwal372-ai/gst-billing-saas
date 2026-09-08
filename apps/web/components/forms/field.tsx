import type { InputHTMLAttributes, ReactNode } from "react";

export const inputClass = "mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20 disabled:bg-slate-100";
export function Field({ label, name, error, hint, children, ...props }: InputHTMLAttributes<HTMLInputElement> & {
  label: string; name: string; error?: string; hint?: string; children?: ReactNode;
}) {
  return <div>
    <label htmlFor={name} className="block text-sm font-medium text-slate-700">{label}{props.required && <span aria-hidden="true"> *</span>}</label>
    {children ?? <input {...props} name={name} id={name} className={inputClass} aria-invalid={Boolean(error)} aria-describedby={error ? name + "-error" : hint ? name + "-hint" : undefined} />}
    {hint && <p id={name + "-hint"} className="mt-1.5 text-xs leading-5 text-slate-500">{hint}</p>}
    {error && <p id={name + "-error"} className="mt-1.5 text-xs text-red-700">{error}</p>}
  </div>;
}
export function FormMessage({ children, success = false }: { children: ReactNode; success?: boolean }) {
  return <div role={success ? "status" : "alert"} className={"rounded-lg border p-3 text-sm leading-6 " + (success ? "border-teal-200 bg-teal-50 text-teal-900" : "border-red-200 bg-red-50 text-red-800")}>{children}</div>;
}
export const buttonClass = "inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-[#123d46] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0b3038] focus-visible:outline-teal-700 disabled:cursor-wait disabled:opacity-60";
