"use client";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../auth/auth-provider";
import { useWorkspace } from "./workspace-provider";
import { Icon } from "./icon";
import { navigation } from "./navigation";
import styles from "./workspace.module.css";

function containDialogFocus(event: ReactKeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab") return;
  const targets = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), summary, [tabindex='0']"))
    .filter((element) => element.getClientRects().length > 0);
  const first = targets[0]; const last = targets[targets.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}

const destinations: Record<string,string> = {Invoices:"/invoices",Quotations:"/quotations","Sales Orders":"/sales-orders","Delivery Challans":"/delivery-challans",Returns:"/sales-returns","Purchase Bills":"/purchase-bills","Purchase Orders":"/purchase-orders","Purchase Returns":"/purchase-returns",Customers:"/customers",Suppliers:"/suppliers",Products:"/products",Categories:"/categories",Stock:"/inventory"};

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { summary } = useWorkspace();
  return <>
    <Link href="/dashboard" className={styles.brand} onClick={onNavigate}><span className={styles.brandMark}>G<span>·</span></span><span>GST Billing<small>BUSINESS WORKSPACE</small></span></Link>
    <div className={styles.businessSelector}>
      <Icon name="building" /><div><span className={styles.eyebrow}>CURRENT BUSINESS</span>
        <strong title={summary?.business?.name}>{summary?.business?.name ?? "Your business"}</strong><small>{summary?.business ? "Owner · Single business" : "Business context loading"}</small></div>
    </div>
    <nav aria-label="Application navigation" className={styles.navigation}>
      <p className={styles.navCaption}>WORKSPACE <span>Upcoming modules marked soon</span></p>
      {navigation.map((item) => item.href ?
        <Link key={item.label} href={item.href} className={styles.navItem} aria-current={pathname === item.href ? "page" : undefined} onClick={onNavigate}>
          <Icon name={item.icon} /><span>{item.label}</span>{pathname === item.href && <span className={styles.activeDot} />}
        </Link> : item.children ?
          <details key={item.label} className={styles.navGroup} open={item.children.some(child => destinations[child] && pathname.startsWith(destinations[child])) ? true : undefined}>
            <summary className={styles.navItem}><Icon name={item.icon} /><span>{item.label}</span><Icon name="chevron" className={styles.groupChevron} /></summary>
            <div className={styles.navChildren}>{item.children.map((child) => destinations[child] ? <Link key={child} href={destinations[child]!} aria-current={pathname.startsWith(destinations[child]!) ? "page" : undefined} onClick={onNavigate}>{child}</Link> : <button key={child} disabled>{child}<small>Soon</small></button>)}</div>
          </details> : <button key={item.label} className={styles.navItem} disabled><Icon name={item.icon} /><span>{item.label}</span><small>Soon</small></button>)}
    </nav>
    <div className={styles.sidebarFoot}><span className={styles.statusDot} /><span>Your business, organized.<small>Account & workspace foundation</small></span></div>
  </>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const auth = useAuth(); const router = useRouter();
  const { summary } = useWorkspace();
  const drawer = useRef<HTMLDialogElement>(null);
  const notice = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => {
    const closeMenu = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) menu.current?.removeAttribute("open"); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && menu.current?.open) { menu.current.removeAttribute("open"); menu.current.querySelector("summary")?.focus(); } };
    const resize = () => { if (window.innerWidth >= 1200) drawer.current?.close(); };
    document.addEventListener("pointerdown", closeMenu); document.addEventListener("keydown", escape); window.addEventListener("resize", resize);
    return () => { document.removeEventListener("pointerdown", closeMenu); document.removeEventListener("keydown", escape); window.removeEventListener("resize", resize); };
  }, []);
  async function logout() {
    setBusy(true); setError("");
    try { await auth.logout(); router.replace("/login"); }
    catch { setError("Couldn’t sign out. Please try again."); }
    finally { setBusy(false); }
  }
  const name = [auth.user?.firstName, auth.user?.lastName].filter(Boolean).join(" ");
  return <div className={styles.workspace}>
    <a href="#workspace-main" className={styles.skipLink}>Skip to main content</a>
    <aside className={styles.sidebar}><Sidebar /></aside>
    <dialog ref={drawer} aria-label="Application navigation" className={styles.drawer} onKeyDown={containDialogFocus} onClick={(event) => { if (event.target === event.currentTarget) drawer.current?.close(); }}>
      <div className={styles.drawerContent}><button autoFocus className={styles.drawerClose} aria-label="Close navigation" onClick={() => drawer.current?.close()}><Icon name="close" /></button><Sidebar onNavigate={() => drawer.current?.close()} /></div>
    </dialog>
    <div className={styles.mainColumn}>
      <header className={styles.topbar}>
        <button className={`${styles.iconButton} ${styles.mobileTrigger}`} aria-label="Open navigation" aria-haspopup="dialog" onClick={() => drawer.current?.showModal()}><Icon name="menu" /></button>
        <div className={styles.breadcrumb}><span>Workspace</span><Icon name="chevron" /><strong>{Object.entries(destinations).find(([,path])=>pathname.startsWith(path))?.[0] ?? "Dashboard"}</strong></div>
        <div className={styles.topbarActions}>
          <div className={styles.search}><Icon name="search" /><input aria-label="Global search (coming soon)" placeholder="Search invoices, customers, products..." disabled /><span>Soon</span></div>
          <button className={styles.iconButton} aria-label="Notifications (coming soon)" aria-haspopup="dialog" onClick={() => notice.current?.showModal()}><Icon name="bell" /></button>
          <details className={styles.account} ref={menu}>
            <summary aria-label="Open account menu"><span className={styles.avatar}>{auth.user?.firstName.slice(0, 1)}{auth.user?.lastName.slice(0, 1)}</span><span className={styles.accountLabel}>{auth.user?.firstName}<small>Business account</small></span><Icon name="chevron" /></summary>
            <div className={styles.accountPopover}><strong>{name}</strong><p>{auth.user?.email}</p><span className={styles.pill}>{summary?.business?.role === "OWNER" ? "Owner workspace" : "Business account"}</span>
              <Link href="/onboarding" onClick={() => menu.current?.removeAttribute("open")}><Icon name="building" />Business profile</Link>
              <button disabled><Icon name="settings" />Account settings <small>Soon</small></button>
              <button onClick={() => void logout()} disabled={busy}><Icon name="logout" />{busy ? "Signing out…" : "Sign out"}</button>
              {error && <p role="alert" className={styles.errorText}>{error}</p>}
            </div>
          </details>
        </div>
      </header>
      <main id="workspace-main" tabIndex={-1} className={styles.main}>{children}</main>
      <footer className={styles.footer}><span>GST Billing · Your business workspace</span><span>Financial modules coming soon</span></footer>
    </div>
    <dialog ref={notice} aria-labelledby="notifications-title" className={styles.notice} onKeyDown={containDialogFocus}>
      <button autoFocus className={styles.iconButton} aria-label="Close notifications" onClick={() => notice.current?.close()}><Icon name="close" /></button>
      <Icon name="bell" width={32} height={32} /><h2 id="notifications-title">A place for every update</h2><p>Notifications are coming soon. Business updates will appear here when this feature is available.</p>
    </dialog>
  </div>;
}
