import type { Metadata } from "next";

import { PortalScreen } from "@/components/portal/PortalScreen";

export const metadata: Metadata = {
  // `absolute` shart: ildiz maketining shabloni "| Elektr energiyasi analitik
  // platformasi" qo'shadi, bu esa uch tarmoqli portal uchun noto'g'ri.
  title: { absolute: "Baliqchi tumani — Yoqilg’i-energetika tizimi" },
  description:
    "Baliqchi tumani yoqilg’i-energetika tizimi: elektr energiyasi, tabiiy gaz va ichimlik suvi yo’nalishlari.",
};

export default function RootPage() {
  return <PortalScreen />;
}
