import { Download, FileSpreadsheet } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { TEMPLATE_FILE_NAME, TEMPLATE_LABEL, TEMPLATE_ORDER } from "@/lib/domain/labels";

import { TEMPLATE_DOWNLOAD_PATH, TEMPLATE_STEP } from "./templateFiles";

/**
 * Yuklash tartibi va bo'sh shablonlarni yuklab olish. Tartib qoidasi:
 * `.claude/docs/malumotlar.md` 4.2 - har bir shablon o'zidan oldingisiga tayanadi.
 */
export function TemplateGuideCard() {
  return (
    <Card className="h-auto!">
      <CardHeader title="Shablonlar va yuklash tartibi" />
      <CardBody className="gap-3">
        <p className="text-[11px] leading-4 text-ink-soft">
          Podstansiyalar → Fiderlar → Transformatorlar → Abonentlar → Qoidabuzarliklar, Murojaatlar. Bir oyning
          fayllarini birga tanlash mumkin - ular shu tartibda tekshiriladi.
        </p>

        <ol className="flex flex-col gap-1.5">
          {TEMPLATE_ORDER.map((type) => (
            <li
              key={type}
              className="flex h-11 items-center gap-2.5 rounded-lg border border-solid border-hairline px-2.5"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-tint-blue text-[11px] font-bold text-brand">
                {TEMPLATE_STEP[type]}
              </span>
              <span className="shrink-0 text-accent-green">
                <Icon icon={FileSpreadsheet} size={18} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-semibold text-ink">{TEMPLATE_LABEL[type]}</span>
                <span className="truncate text-[10px] text-ink-soft">{TEMPLATE_FILE_NAME[type]}</span>
              </span>
              <a
                href={TEMPLATE_DOWNLOAD_PATH[type]}
                download={TEMPLATE_FILE_NAME[type]}
                aria-label={`${TEMPLATE_LABEL[type]} shablonini yuklab olish`}
                title="Bo’sh shablonni yuklab olish"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink transition-colors hover:bg-black/5"
              >
                <Icon icon={Download} size={16} />
              </a>
            </li>
          ))}
        </ol>

        <ul className="flex list-disc flex-col gap-1 pl-4 text-[11px] leading-4 text-ink-soft">
          <li>Varaq nomi - hisobot sanasi, masalan “13-sentabr, 2026”. Oy shu sanadan olinadi.</li>
          <li>Shu oy uchun shablon qayta yuklansa, oyning shu shablondagi yozuvlari to’liq almashtiriladi.</li>
          <li>Bitta faylda xato bo’lsa, butun yuklash rad etiladi - hech narsa saqlanmaydi.</li>
        </ul>
      </CardBody>
    </Card>
  );
}
