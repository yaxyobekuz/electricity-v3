import Image from "next/image";

/**
 * "Mobil ilovani yuklab olish" (Figma `4416:2`, 321.78x238).
 *
 * Reklama kartasi - bazadan ma'lumot olmaydi. Telefon maketi rasm sifatida
 * kartaning yuqorisiga joylashadi, pastda oq gradient bilan so'niydi;
 * o'ng yuqori burchakda do'kon belgilari.
 *
 * Ilova hali chiqmagani uchun tugma va belgilar havola emas.
 */
export function MobileAppCard({ className }: { className?: string }) {
  return (
    <section
      className={
        "relative flex min-h-0 flex-col justify-end overflow-hidden rounded-2xl bg-surface p-5 " +
        (className ?? "")
      }
    >
      <Image
        src="/home/mobile-app.png"
        alt="Mobil ilova ko’rinishi"
        fill
        sizes="322px"
        className="object-cover object-top"
      />
      {/* Rasm pastda oq fonga singib ketadi - tugma ustida matn o'qilishi uchun. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[60px] bg-gradient-to-b from-white/30 to-white"
      />

      <span className="absolute top-3 right-3 flex items-center gap-2.5">
        <Image src="/home/google-play.svg" alt="Google Play" width={20} height={20} />
        <Image src="/home/app-store.svg" alt="App Store" width={24} height={24} />
      </span>

      <button
        type="button"
        disabled
        title="Ilova hali chiqmagan"
        className="relative flex cursor-not-allowed items-center justify-center rounded-md bg-brand px-5 py-3 text-xs leading-4 font-medium text-white shadow-[0_2px_4px_0_rgba(0,0,0,0.25)]"
      >
        Mobil ilovani yuklab olish
      </button>
    </section>
  );
}
