"use client";

import { FileText } from "lucide-react";
import { type ComponentType, type SVGProps, useState } from "react";

import { Card, CardBody, CardFooterLink, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ExcelMark, PdfMark } from "@/components/ui/icons/BrandMarks";
import type { ReportFormat, ReportPeriod } from "@/lib/reports/types";
import { cn } from "@/lib/ui/cn";

interface PeriodOption {
  id: ReportPeriod;
  label: string;
  /** Har bir davr o'z aksent rangida - maketdan olingan. */
  tone: string;
}

const PERIODS: readonly PeriodOption[] = [
  { id: "daily", label: "Kunlik", tone: "text-brand" },
  { id: "weekly", label: "Haftalik", tone: "text-accent-green" },
  { id: "monthly", label: "Oylik", tone: "text-accent-purple" },
  { id: "yearly", label: "Yillik", tone: "text-accent-indigo" },
];

interface FormatOption {
  id: ReportFormat;
  label: string;
  Mark: ComponentType<SVGProps<SVGSVGElement>>;
  /**
   * Fon - format rangining ~10% shaffofligi (maketdan olingan aniq qiymatlar),
   * shuning uchun `tint-*` tokenlari bu yerga mos tushmaydi.
   */
  tone: string;
}

const FORMATS: readonly FormatOption[] = [
  { id: "xlsx", label: "Excel", Mark: ExcelMark, tone: "bg-[#e8f5ef] text-[#107c41]" },
  { id: "pdf", label: "PDF", Mark: PdfMark, tone: "bg-[#f9e6e6] text-[#c80a0a]" },
];

/**
 * Fider sahifasining 4-qatoridagi "Hisobotlarni yuklab olish" kartasi
 * (span-4, 209px). Maketda karta pasti 8px (16px emas), chunki havola
 * o'zining ichki bo'shlig'iga ega - shuning uchun `pb-2`.
 *
 * Davr tanlanadi, format tugmasi esa `/api/reports` dan tayyor faylni
 * yuklab beradi (javobda `Content-Disposition: attachment`).
 */
export function DownloadReportsCard({ className }: { className?: string }) {
  const [period, setPeriod] = useState<ReportPeriod>("daily");
  const periodLabel = PERIODS.find((item) => item.id === period)?.label ?? "";

  return (
    <Card className={cn("pb-2", className)}>
      {/* Bu kartada sarlavha amallari yo'q, shuning uchun balandligi 32 emas 18px. */}
      <CardHeader
        title="Hisobotlarni yuklab olish"
        className="h-[18px]!"
        titleClassName="text-black"
      />
      <CardBody>
        {/* 4 x 64.94px, 10px oraliq; qolgan balandlikni shu qator yutadi. */}
        <div className="grid min-h-0 flex-1 grid-cols-4 gap-2.5">
          {PERIODS.map((option) => {
            const selected = option.id === period;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setPeriod(option.id)}
                className={cn(
                  "flex min-w-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[6px] border transition-colors",
                  selected
                    ? "border-brand bg-tint-blue text-brand"
                    : cn("border-[#dddddd] bg-canvas hover:bg-[#ececec]", option.tone),
                )}
              >
                <Icon icon={FileText} size={20} />
                {/* Maketda bu yorliqlar `ink` (#333) emas, qora - o'lchangan. */}
                <span className="text-xs font-medium text-black">{option.label}</span>
              </button>
            );
          })}
        </div>

        {/* Format tugmalari: 139.89 x 48px kapsulalar, 10px oraliq. */}
        <div className="mt-3 grid h-12 shrink-0 grid-cols-2 gap-2.5">
          {FORMATS.map((format) => (
            <a
              key={format.id}
              href={`/api/reports?period=${period}&format=${format.id}`}
              download
              aria-label={`${periodLabel} hisobotni ${format.label} sifatida yuklab olish`}
              className={cn(
                "flex min-w-0 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-80",
                format.tone,
              )}
            >
              <format.Mark width={24} height={24} />
              {format.label}
            </a>
          ))}
        </div>

        {/* Maketdagi havola ustidagi ajratuvchi chiziq. */}
        <div className="mt-2 h-px shrink-0 bg-[#dddddd]" />
      </CardBody>
      <CardFooterLink>Ko&rsquo;proq</CardFooterLink>
    </Card>
  );
}
