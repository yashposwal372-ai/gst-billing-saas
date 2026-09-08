import type { SVGProps } from "react";
import {
  LayoutGrid, FileText, ShoppingBag, Package, Users, Wallet, Landmark,
  ChartNoAxesCombined, Bell, Sparkles, Settings, CircleHelp, Menu, X,
  ChevronRight, Search, Plus, ArrowRight, Check, Clock, CalendarDays,
  LogOut, Building2, ReceiptText, Monitor,
} from "lucide-react";

const icons = {
  grid: LayoutGrid, document: FileText, bag: ShoppingBag, box: Package,
  people: Users, wallet: Wallet, bank: Landmark, chart: ChartNoAxesCombined,
  bell: Bell, spark: Sparkles, settings: Settings, help: CircleHelp, menu: Menu,
  close: X, chevron: ChevronRight, search: Search, plus: Plus, arrow: ArrowRight,
  check: Check, clock: Clock, calendar: CalendarDays, logout: LogOut,
  building: Building2, receipt: ReceiptText, monitor: Monitor,
} as const;
export type IconName = keyof typeof icons;
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const Component = icons[name];
  return <Component width={20} height={20} strokeWidth={1.65} aria-hidden="true" {...props} />;
}
