import type { ReactNode } from "react";
import { RequireAuth } from "../../components/auth/require-auth";
import { WorkspaceProvider } from "../../components/workspace/workspace-provider";
import { AppShell } from "../../components/workspace/app-shell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <RequireAuth><WorkspaceProvider><AppShell>{children}</AppShell></WorkspaceProvider></RequireAuth>;
}
