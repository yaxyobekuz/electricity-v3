/**
 * Sahifa ma'lumoti serverdan kelguncha ko'rsatiladigan neytral skelet.
 *
 * Next `loading.tsx` ni maketning har bir slotiga qo'yadi - kontent
 * (`children`) bilan birga yon panel sarlavhasi (`@title`) ichida ham
 * chiziladi. Sarlavha ichida (`.workspace-title`) faqat ixcham chiziq
 * ko'rinadi, katta skelet yashiriladi.
 */
export default function Loading() {
  return (
    <>
      <span
        aria-hidden
        className="hidden h-4 w-44 animate-pulse rounded-full bg-canvas align-middle [.workspace-title_&]:inline-block"
      />
      <div
        role="status"
        aria-label="Yuklanmoqda"
        className="flex h-full min-h-0 flex-col gap-2 [.workspace-title_&]:hidden"
      >
        <div className="flex h-14 shrink-0 items-center rounded-xl bg-surface px-4">
          <span className="h-4 w-48 animate-pulse rounded-full bg-canvas" />
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="flex h-24 flex-col justify-center gap-3 rounded-xl bg-surface p-4"
            >
              <span className="h-3 w-24 animate-pulse rounded-full bg-canvas" />
              <span className="h-5 w-32 animate-pulse rounded-full bg-canvas" />
            </div>
          ))}
        </div>
        <div className="min-h-0 flex-1 animate-pulse rounded-xl bg-surface" />
      </div>
    </>
  );
}
