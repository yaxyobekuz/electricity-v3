import type { ReactNode } from "react";

import { IconRail } from "./IconRail";

/**
 * Butun ekran maketi: 8px tashqi bo'shliq, 8px ustunlararo bo'shliq.
 * Chapda 72px ikonka paneli, keyin 340px ikkilamchi panel, qolgani - kontent.
 */
export function AppShell({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen w-full gap-2 overflow-hidden bg-canvas p-2">
      <IconRail />
      {sidebar}
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}

/** Ikkilamchi panel qobig'i (340px, oq, r16). */
export function SidebarPanel({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <aside className="flex w-[340px] shrink-0 flex-col justify-between gap-4 overflow-hidden rounded-2xl bg-surface p-4">
      <div className="flex min-h-0 flex-col gap-2 overflow-y-auto scrollbar-none">
        <h1 className="shrink-0 truncate text-base font-bold text-ink">{title}</h1>
        {children}
      </div>
      {footer}
    </aside>
  );
}
