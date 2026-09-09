import { ArrowRight, CircleCheck } from "lucide-react";
import Link from "next/link";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

// Maketdagi o'zbekcha apostrof - U+2019: JSX matnida `&rsquo;`, bu yerdagi
// `string` konstantalarda esa `\u2019` escape sifatida yoziladi.

interface Recommendation {
  id: string;
  text: string;
}

/** Tavsiyalar tahlil natijasi emas, maketdagi qat'iy ro'yxat (mock). */
const RECOMMENDATIONS: readonly Recommendation[] = [
  { id: "tp-043-load", text: "TP-043 da yuklamani 80% dan pastga tushirish" },
  {
    id: "commercial-loss-audit",
    text: "Tijorat yo\u2019qotishlar bo\u2019yicha tekshiruv o\u2019tkazish",
  },
  { id: "meter-recalibration", text: "Hisoblagichlarni qayta kalibrlash (12 ta)" },
  {
    id: "qorakol-modernization",
    text: "Qorako\u2019l hududida tarmoqni modernizatsiya qilish",
  },
  {
    id: "loss-reduction-2026",
    text: "2026-2027 yillarda yo\u2019qotishlarni 5% ga kamaytirish",
  },
];

/**
 * "Reja va tavsiyalar" (bosh sahifa, 4-qator, 363x262).
 *
 * Karta ichida 230px joy bor: sarlavha 32 + tana 190 (`CardBody` pt-2 bilan).
 * Tugma pastda qat'iy 36px (`shrink-0`), ro'yxat esa qolgan balandlikni
 * egallaydi va uzun matn ko'rinmas skroll bilan sig'adi - shu sababli
 * ro'yxatda `min-h-0 flex-1 overflow-y-auto`.
 */
export function RecommendationsCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title="Reja va tavsiyalar">
        {/* Sana - amal tugmasi emas, shuning uchun oddiy matn. */}
        <span className="shrink-0 text-[10px] text-ink-soft">10-avgust, 2026</span>
      </CardHeader>

      <CardBody>
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto scrollbar-none">
          {RECOMMENDATIONS.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              {/* `mt-px` - 16px ikonkani 15px qator balandligiga tekislaydi. */}
              <Icon icon={CircleCheck} size={16} className="mt-px shrink-0 text-state-ok" />
              <span className="text-[11px] leading-[15px] text-ink">{item.text}</span>
            </li>
          ))}
        </ul>

        {/* Tugma ro'yxatdan keyin keladi, lekin hech qachon siqilmaydi. */}
        <Link
          href="/reports"
          className="mt-2 flex h-9 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-brand text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          Barcha tavsiyalar
          <Icon icon={ArrowRight} size={16} />
        </Link>
      </CardBody>
    </Card>
  );
}
