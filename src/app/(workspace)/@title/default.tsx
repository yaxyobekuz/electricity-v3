/*
 * Yon panel sarlavhasi sloti (`@title`). Faqat obyekt sahifalarida
 * (`substations/[id]`, `feeders/[id]`, `transformers/[id]`,
 * `subscribers/[id]`) obyekt nomini bazadan olib beradi; qolgan sahifalarda
 * `WorkspaceSidebar` slotni umuman ko'rsatmaydi va tuman sarlavhasini
 * o'zi chizadi.
 *
 * Sabab: `(workspace)/loading.tsx` maketning HAR BIR slotini Suspense bilan
 * o'raydi - ro'yxat sahifalari orasida o'tishda ham sarlavha skeletga
 * almashib "miltillardi". Slot faqat nom haqiqatan yuklanayotganda kerak.
 *
 * `default.tsx` - to'liq yuklashda slot URL ga mos kelmasa (obyekt sahifasi
 * emas) chiziladi; u holda slot ko'rinmaydi.
 */
export default function Default() {
  return null;
}
