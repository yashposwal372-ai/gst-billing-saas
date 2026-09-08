import type { Metadata } from "next";
import { Dashboard } from "../../../components/workspace/dashboard";
export const metadata: Metadata = { title: "Dashboard | GST Billing" };
export default function DashboardPage() { return <Dashboard />; }
