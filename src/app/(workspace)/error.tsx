"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { Icon } from "@/components/ui/Icon";

/**
 * Ish maydoni sahifasida kutilmagan xato (masalan, baza bilan aloqa uzilgan).
 * Yon panel joyida qoladi; `retry` segmentni serverdan qayta so'raydi.
 *
 * Bu chegara shu papkadagi `layout.tsx` ni o'ramaydi - shuning uchun maket
 * bazaga o'zi murojaat qilmaydi, yon paneldagi oy tanlagichi
 * (`SidebarPeriod`) esa o'z xatosini o'zi ushlaydi.
 *
 * Xato chegarasi yon panel sarlavhasi slotini ham o'raydi - sarlavha
 * ichida (`.workspace-title`) karta yashiriladi, xabar kontentda chiqadi.
 */
export default function WorkspaceError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex h-full min-h-60 flex-col items-center justify-center gap-3 rounded-2xl bg-surface p-8 text-center [.workspace-title_&]:hidden"
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-canvas text-brand">
        <Icon icon={TriangleAlert} size={28} />
      </span>
      <p className="text-base font-semibold text-ink">Ma’lumotni yuklashda xatolik yuz berdi</p>
      <p className="max-w-sm text-sm text-ink-muted">
        Birozdan so’ng qayta urinib ko’ring.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <Icon icon={RotateCw} size={16} />
        Qayta urinish
      </button>
    </div>
  );
}
