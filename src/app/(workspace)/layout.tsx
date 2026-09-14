import { Suspense } from "react";

import { AppShell } from "@/components/shell/AppShell";
import { SidebarPeriod, SidebarPeriodSkeleton } from "@/components/shell/SidebarPeriod";
import { WorkspaceSidebar } from "@/components/shell/WorkspaceSidebar";

/**
 * Ish maydoni maketi. Ataylab sinxron: cookie va bazani o'qiydigan oy
 * tanlagichi alohida `<Suspense>` ichida (`SidebarPeriod`), shuning uchun
 * qobiq darhol chiziladi va `loading.tsx` sahifani qoplay oladi.
 * `title` - `@title` sloti (obyekt sahifalarida obyekt nomi).
 */
export default function WorkspaceLayout({ children, title }: LayoutProps<"/">) {
  return (
    <AppShell
      sidebar={
        <WorkspaceSidebar
          title={title}
          periodSelect={
            <Suspense fallback={<SidebarPeriodSkeleton />}>
              <SidebarPeriod />
            </Suspense>
          }
        />
      }
    >
      {children}
    </AppShell>
  );
}
