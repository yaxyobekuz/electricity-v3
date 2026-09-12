"use client";

import { useLinkStatus } from "next/link";

/**
 * Havola bosilgandan keyingi yuklanish chizig'i.
 *
 * `/dashboard` og'ir marshrut - bosgandan keyin ekran bir necha yuz
 * millisekund qimirlamaydi. Bu chiziq shu bo'shliqni to'ldiradi.
 * Faqat `<Link>` ichida ishlaydi (`useLinkStatus` shuni talab qiladi).
 */
export function PendingBar() {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <>
      {/* `.portal-pending` chiziqni plita chetiga chiqaradi - u aks holda
          ichki kontent qutisining pastiga tushib qolardi. */}
      <span aria-hidden className="portal-pending pointer-events-none">
        <span className="portal-pending-bar block h-full w-1/3 bg-[var(--s-base)]" />
      </span>
      <span role="status" className="sr-only">
        Ochilmoqda…
      </span>
    </>
  );
}
