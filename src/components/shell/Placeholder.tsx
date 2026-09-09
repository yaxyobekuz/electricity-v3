import { Construction } from "lucide-react";

/** Maket bosqichida hali chizilmagan sahifalar uchun vaqtinchalik ko'rinish. */
export function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl bg-surface">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-canvas text-brand">
        <Construction className="size-7" strokeWidth={1.8} />
      </span>
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="max-w-sm text-center text-sm text-ink-muted">
        Bu sahifa maketi hali tayyorlanmoqda.
      </p>
    </div>
  );
}
