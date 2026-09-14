import { NotFoundView } from "@/components/shell/NotFoundView";

/** Ish maydonidan tashqaridagi (portal, xarita, qidiruv) topilmagan sahifa. */
export default function NotFound() {
  return (
    <div className="flex h-screen w-full bg-canvas p-2">
      <NotFoundView href="/" linkLabel="Bosh sahifaga qaytish" />
    </div>
  );
}
