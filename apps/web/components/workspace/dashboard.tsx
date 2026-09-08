"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "../auth/auth-provider";
import { periods, type DashboardFilter } from "../../lib/dashboard";
import { useWorkspace } from "./workspace-provider";
import { Icon, type IconName } from "./icon";
import styles from "./workspace.module.css";

const metrics: { label: string; icon: IconName; note: string }[] = [
  { label: "Today’s sales", icon: "chart", note: "Sales insights coming soon" },
  { label: "Monthly sales", icon: "calendar", note: "Your month at a glance" },
  { label: "GST collected", icon: "receipt", note: "Tax insights coming soon" },
  { label: "Outstanding receivables", icon: "wallet", note: "Payments insights coming soon" },
  { label: "Active customers", icon: "people", note: "Current active customer records" },
  { label: "Active suppliers", icon: "people", note: "Current active supplier records" },
  { label: "Total products", icon: "box", note: "Your catalogue starts here" },
  { label: "Low stock", icon: "bag", note: "Stock alerts coming soon" },
  { label: "Overdue invoices", icon: "clock", note: "Invoice tracking coming soon" },
];
const quickActions: { label: string; icon: IconName }[] = [
  { label: "Create invoice", icon: "document" }, { label: "Add customer", icon: "people" },
  { label: "Add product", icon: "box" }, { label: "Record purchase", icon: "bag" },
];

function DateFilter() {
  const { filter, setFilter } = useWorkspace();
  const [selected, setSelected] = useState<DashboardFilter["period"]>(filter.period);
  const [error, setError] = useState("");
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const start = String(data.get("start") ?? ""); const end = String(data.get("end") ?? "");
    if (!start || !end || start > end) { setError("Choose a start date on or before the end date."); return; }
    setError(""); setFilter({ period: "custom", start, end });
  }
  return <div className={styles.dateFilter}>
    <label className={styles.periodSelect}><Icon name="calendar" /><span className={styles.srOnly}>Dashboard date range</span><select value={selected} onChange={(event) => {
      const period = event.target.value as DashboardFilter["period"]; setSelected(period); setError("");
      if (period !== "custom") setFilter({ period });
    }}>{periods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {selected === "custom" && <form onSubmit={apply} className={styles.customRange}>
      <label>From<input name="start" type="date" required defaultValue={filter.start} /></label><label>To<input name="end" type="date" required defaultValue={filter.end} /></label><button className={styles.secondaryButton}>Apply</button>
      {error && <span role="alert" className={styles.errorText}>{error}</span>}
    </form>}
  </div>;
}

export function DashboardSkeleton() {
  return <div role="status" aria-label="Loading dashboard" className={styles.skeletonArea}>
    <span className={styles.srOnly}>Loading your business and dashboard</span><div className={styles.skeletonHeading} />
    <div className={styles.kpiGrid}>{Array.from({ length: 8 }, (_, index) => <div className={styles.skeletonCard} key={index} />)}</div>
    <div className={styles.chartGrid}><div className={styles.skeletonPanel} /><div className={styles.skeletonPanel} /></div>
  </div>;
}
function EmptyPanel({ title, subtitle, icon, text, wide = false }: { title: string; subtitle: string; icon: IconName; text: string; wide?: boolean }) {
  return <section className={`${styles.panel} ${wide ? styles.widePanel : ""}`}>
    <div className={styles.panelHeader}><div><h2>{title}</h2><p>{subtitle}</p></div><span className={styles.pill}>Coming soon</span></div>
    <div className={styles.emptyPanel}><span className={styles.emptyIcon}><Icon name={icon} width={25} height={25} /></span><h3>No data available yet</h3><p>{text}</p></div>
  </section>;
}
export function Dashboard() {
  const { user } = useAuth(); const { summary, loading, error, retry } = useWorkspace();
  if (error) return <section className={styles.errorPanel} role="alert"><Icon name="help" width={32} height={32} /><h1>Let’s reconnect your workspace</h1><p>{error}</p><button className={styles.primaryButton} onClick={retry}>Try again</button><Link href="/onboarding">Review business profile</Link></section>;
  if (!summary || !user?.currentBusinessId) return <DashboardSkeleton />;
  const selectedPeriod = periods.find(([key]) => key === summary.filter.period)?.[1] ?? "Selected period";
  return <>
    <div className={styles.pageHeading}><div><p className={styles.eyebrow}>YOUR BUSINESS AT A GLANCE</p><h1>Welcome back, {user.firstName}.</h1><p>Here’s the overview for <strong>{summary.business?.name}</strong>.</p></div><DateFilter /></div>
    <section className={styles.setupBanner}><span className={styles.bannerIcon}><Icon name="check" /></span><div><strong>A strong start for your business</strong><p>Your profile is ready. Sales, inventory and financial insights will arrive with upcoming modules.</p></div><Link href="/onboarding">Review profile<Icon name="arrow" /></Link></section>
    <section className={styles.quickActions} aria-label="Quick actions"><span>Quick actions</span>{quickActions.map((action) => action.label === "Add customer" ? <Link key={action.label} href="/customers/new"><Icon name={action.icon} /><span>{action.label}</span></Link> : <button disabled key={action.label}><Icon name={action.icon} /><span>{action.label}</span><small>Soon</small></button>)}</section>
    {loading ? <DashboardSkeleton /> : <div aria-live="polite" aria-atomic="false">
      <div className={styles.sectionLabel}><h2>Business overview</h2><span>{selectedPeriod} · INR · India time</span></div>
      <div className={styles.kpiGrid}>{metrics.map((metric) => <section key={metric.label} className={styles.kpiCard}>
        <div><h3>{metric.label}</h3><Icon name={metric.icon} /></div><p className={styles.metricValue}>{metric.label === "Active customers" ? summary.metrics.customers ?? "—" : metric.label === "Active suppliers" ? summary.metrics.suppliers ?? "—" : <span aria-label="Not available">—</span>}</p><p className={styles.metricNote}>{metric.note}</p>
      </section>)}</div>
      <div className={styles.chartGrid}>
        <section className={`${styles.panel} ${styles.salesPanel}`}>
          <div className={styles.panelHeader}><div><h2>Sales overview</h2><p>A clearer picture of your business performance</p></div><span className={styles.pill}>{selectedPeriod}</span></div>
          <div className={styles.salesLegend}><span />Sales <i />Purchases<span className={styles.legendNote}>Insights coming soon</span></div>
          <div className={styles.emptyChart}><div className={styles.chartGridlines} aria-hidden="true"><span /><span /><span /><span /></div><div className={styles.chartMessage}><span className={styles.emptyIcon}><Icon name="chart" width={26} height={26} /></span><h3>Your story starts here</h3><p>Sales and purchase trends will appear when<br />those modules become available.</p></div></div>
          <div className={styles.panelFoot}>No financial data is available for this period.</div>
        </section>
        <section className={`${styles.panel} ${styles.gettingStarted}`}><div className={styles.panelHeader}><div><h2>Make yourself at home</h2><p>A few steps toward your first sale</p></div><Icon name="spark" /></div>
          <div className={styles.progressLabel}><span>Workspace setup</span><strong>{summary.metrics.customers ? 2 : 1} of 4</strong></div><progress value={summary.metrics.customers ? 2 : 1} max={4} aria-label="Workspace setup progress" />
          <ol className={styles.checklist}><li><span className={styles.complete}><Icon name="check" /></span><div><strong>Set up your business</strong><small>Profile complete</small></div><Link href="/onboarding" aria-label="Review business profile"><Icon name="arrow" /></Link></li>
            <li><span>{summary.metrics.customers ? <Icon name="check" /> : 2}</span><div><strong>Add your first customer</strong><small>{summary.metrics.customers ? "Customer added" : "Ready to begin"}</small></div><Link href="/customers/new" aria-label="Add customer"><Icon name="arrow" /></Link></li>
            {["Add your first product", "Create your first invoice"].map((label, index) => <li key={label}><span>{index + 3}</span><div><strong>{label}</strong><small>Coming soon</small></div></li>)}</ol>
          <p className={styles.checklistNote}>Your next chapter is on its way. We’ll make each step simple.</p>
        </section>
      </div>
      <div className={styles.smallPanelGrid}>
        <EmptyPanel title="GST collection" subtitle="Tax collected across your sales" icon="receipt" text="GST insights will be available with billing." />
        <EmptyPanel title="Invoice status" subtitle="Keep an eye on every invoice" icon="document" text="Paid, pending and overdue invoices will appear here." />
        <EmptyPanel title="Payment methods" subtitle="Understand how customers pay" icon="wallet" text="Payment breakdowns will be available with payments." />
      </div>
      <div className={styles.chartGrid}>
        <section className={`${styles.panel} ${styles.widePanel}`}><div className={styles.panelHeader}><div><h2>Recent activity</h2><p>The latest across your business</p></div><Icon name="clock" /></div>
          <div className={styles.activityColumns} aria-hidden="true"><span>ACTIVITY</span><span>DATE</span><span>STATUS</span></div><div className={styles.emptyPanel}><span className={styles.emptyIcon}><Icon name="clock" /></span><h3>No activity yet</h3><p>New transactions and business updates will appear here.</p></div>
        </section>
        <EmptyPanel title="Top products" subtitle="Your best performers, in one place" icon="box" text="Product rankings will be available with inventory and sales." />
      </div>
    </div>}
  </>;
}
