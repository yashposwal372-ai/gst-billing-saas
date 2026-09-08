import type { IconName } from "./icon";
type NavigationItem = { label: string; icon: IconName; href?: string; children?: readonly string[] };
export const navigation: readonly NavigationItem[] = [
  { label: "Dashboard", icon: "grid", href: "/dashboard" },
  { label: "Sales", icon: "document", children: ["Invoices", "Quotations", "Sales Orders", "Delivery Challans", "Returns"] },
  { label: "Purchases", icon: "bag", children: ["Purchase Bills", "Purchase Orders", "Purchase Returns"] },
  { label: "POS", icon: "monitor" },
  { label: "Inventory", icon: "box", children: ["Products", "Categories", "Stock", "Warehouses", "Stock Transfers", "Barcode"] },
  { label: "Parties", icon: "people", children: ["Customers", "Suppliers"] },
  { label: "Payments", icon: "wallet", children: ["Receivables", "Payables", "Payment History"] },
  { label: "Expenses", icon: "receipt" }, { label: "Banking", icon: "bank" },
  { label: "GST", icon: "receipt", children: ["GST Dashboard", "GST Reports", "GSTR-1", "GSTR-3B", "HSN Summary", "E-Invoice", "E-Way Bill"] },
  { label: "Reports", icon: "chart" }, { label: "Employees", icon: "people" },
  { label: "Notifications", icon: "bell" }, { label: "AI Assistant", icon: "spark" },
  { label: "Documents", icon: "document" }, { label: "Support", icon: "help" }, { label: "Settings", icon: "settings" },
];
