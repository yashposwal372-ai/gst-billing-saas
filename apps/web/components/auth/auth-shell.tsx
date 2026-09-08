import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="min-h-dvh bg-[#f4f6f9] text-slate-900 lg:grid lg:grid-cols-[minmax(320px,0.9fr)_1.1fr]">
    <aside className="flex flex-col justify-between bg-[#112438] px-8 py-8 text-white lg:min-h-dvh lg:px-14 lg:py-12">
      <Link href="/login" className="flex w-fit items-center gap-3 font-semibold tracking-tight">
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-teal-300 text-lg text-slate-950">G</span>
        GST Billing <span className="font-normal text-slate-400">/ Business</span>
      </Link>
      <div className="hidden max-w-md lg:block">
        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">A considered start</p>
        <h2 className="text-4xl font-semibold leading-tight tracking-tight">Your business.<br />A workspace of its own.</h2>
        <p className="mt-6 leading-7 text-slate-300">Set up your account and business details in one place, ready for what comes next.</p>
        <div className="mt-10 border-t border-white/15 pt-6 text-sm text-slate-300">Built for Indian businesses.</div>
      </div>
      <p className="hidden text-xs text-slate-400 lg:block">Account & business setup</p>
    </aside>
    <section className="flex items-center justify-center px-6 py-12 sm:px-10">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mb-8 mt-3 text-sm leading-6 text-slate-600">{description}</p>
        {children}
      </div>
    </section>
  </main>;
}
