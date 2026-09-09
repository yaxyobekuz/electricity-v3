import { AppShell } from "@/components/shell/AppShell";
import { WorkspaceSidebar } from "@/components/shell/WorkspaceSidebar";

export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return <AppShell sidebar={<WorkspaceSidebar />}>{children}</AppShell>;
}
