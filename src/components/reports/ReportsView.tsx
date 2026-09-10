"use client";

import {
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarFold,
  CalendarRange,
  Clock,
  Download,
  FileText,
  Send,
  Settings2,
} from "lucide-react";
import { type ComponentType, type SVGProps, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, DataTable, type TableColumn } from "@/components/ui/DataTable";
import { type FilterChip, FilterChips } from "@/components/ui/Filters";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { ExcelMark, PdfMark } from "@/components/ui/icons/BrandMarks";
import { HeaderButton, PageHeader } from "@/components/ui/PageHeader";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import { between, dec, num, pick, TODAY, TODAY_TIME } from "@/lib/data/seed";
import { type ReportFormat, type ReportPeriod, REPORT_PERIODS } from "@/lib/reports/types";
import { cn } from "@/lib/ui/cn";

/* ---------------------------------------------------------------------------
   Davr va format lug'atlari - `@/lib/reports/types` dagi kod qiymatlarini
   o'zbekcha yorliqqa bog'laydi (kod inglizcha, UI o'zbekcha).
   --------------------------------------------------------------------------- */

const PERIOD_LABEL: Record<ReportPeriod, string> = {
  daily: "Kunlik",
  weekly: "Haftalik",
  monthly: "Oylik",
  yearly: "Yillik",
};

interface PeriodTile {
  id: ReportPeriod;
  hint: string;
  icon: GlyphIcon;
  /** Ikonka plitkasining foni. */
  accent: string;
}

/** Yuklab olish plitkalari - `/api/reports` qabul qiladigan to'rt davr. */
const PERIOD_TILES: readonly PeriodTile[] = [
  {
    id: "daily",
    hint: "Sutkalik iste’mol, yo’qotish va yuklama dinamikasi",
    icon: CalendarDays,
    accent: "bg-accent-blue",
  },
  {
    id: "weekly",
    hint: "Hafta kesimidagi fider va TP ko’rsatkichlari",
    icon: CalendarRange,
    accent: "bg-accent-green",
  },
  {
    id: "monthly",
    hint: "Oylik hisob-kitob, to’lovlar va yo’qotish tahlili",
    icon: CalendarFold,
    accent: "bg-accent-purple",
  },
  {
    id: "yearly",
    hint: "Yil bo’yicha yakuniy ko’rsatkichlar va taqqoslash",
    icon: CalendarCheck,
    accent: "bg-accent-indigo",
  },
];

interface FormatOption {
  id: ReportFormat;
  label: string;
  Mark: ComponentType<SVGProps<SVGSVGElement>>;
  /**
   * Fon - format brend rangining ~10% shaffofligi (fider sahifasidagi
   * `DownloadReportsCard` bilan bir xil qiymatlar), shuning uchun bu yerda
   * `tint-*` tokenlari ishlatilmaydi.
   */
  tone: string;
}

const FORMATS: readonly FormatOption[] = [
  { id: "xlsx", label: "Excel", Mark: ExcelMark, tone: "bg-[#e8f5ef] text-[#107c41]" },
  { id: "pdf", label: "PDF", Mark: PdfMark, tone: "bg-[#f9e6e6] text-[#c80a0a]" },
];

/* ---------------------------------------------------------------------------
   Maket ma'lumotlari - `seed.ts` yordamchilari orqali DETERMINLASHGAN.
   `Math.random` va `new Date()` ishlatilmaydi: server va mijoz bir xil markup
   chizishi shart (gidratsiya xatosi bo'lmasligi uchun).
   --------------------------------------------------------------------------- */

const REPORT_SCOPES = [
  "Baliqchi-1 fideri",
  "Baliqchi-2 fideri",
  "35/10 kV Baliqchi PS",
  "Tuman kesimi",
  "Oqoltin fideri",
] as const;

const REPORT_AUTHORS = [
  "A. Karimov",
  "D. Yo’ldoshev",
  "S. Rahmonova",
  "N. Tursunov",
  "M. Ergashev",
] as const;

interface RecentReport {
  id: string;
  name: string;
  period: ReportPeriod;
  format: ReportFormat;
  /** Tayyor formatda: "1,2 MB". */
  size: string;
  /** "10-avgust 09:15". */
  date: string;
  author: string;
}

const RECENT_REPORTS: readonly RecentReport[] = Array.from(
  { length: 10 },
  (_, index): RecentReport => {
    const seed = index + 3;
    // Davrlar navbat bilan almashadi - har bir filtr chipiga kamida bitta
    // qator tushishi uchun (bo'sh jadval ko'rinmasin).
    const period = REPORT_PERIODS[index % REPORT_PERIODS.length];
    const sizeKb = between(seed * 5, 240, 2800, 10);
    const hour = between(seed * 7, 8, 19);
    const minute = between(seed * 11, 0, 55, 5);
    const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

    return {
      id: `report-${index}`,
      name: `${PERIOD_LABEL[period]} hisobot · ${pick(seed * 13, REPORT_SCOPES)}`,
      period,
      // Har uchinchi hisobot PDF, qolganlari Excel - takrorlanuvchi naqsh.
      format: index % 3 === 1 ? "pdf" : "xlsx",
      size: `${dec(sizeKb / 1024)} MB`,
      // Sanalar bugundan orqaga: 10-avgust, 9-avgust, ...
      date: `${10 - index}-avgust ${time}`,
      author: pick(seed * 17, REPORT_AUTHORS),
    };
  },
);

/** Bu oyda yuklab olingan hisobotlar va o'tgan oyga nisbatan o'sish. */
const MONTHLY_DOWNLOADS = between(21, 90, 180);
const DOWNLOADS_DELTA = between(23, 8, 26);

interface Schedule {
  id: string;
  /** Kimga jo'natiladi. */
  recipient: string;
  /** "Har kuni, 08:00". */
  cadence: string;
  /** "Kunlik hisobot / PDF". */
  payload: string;
  icon: GlyphIcon;
  accent: string;
  /** `false` - jo'natma vaqtincha to'xtatilgan (nishon ohangi shundan olinadi). */
  active: boolean;
}

const SCHEDULES: readonly Schedule[] = [
  {
    id: "hokimlik",
    recipient: "Baliqchi tuman hokimligi",
    cadence: "Har kuni, 08:00",
    payload: "Kunlik hisobot, PDF",
    icon: CalendarDays,
    accent: "bg-accent-blue",
    active: true,
  },
  {
    id: "viloyat",
    recipient: "Viloyat elektr tarmoqlari boshqarmasi",
    cadence: "Har dushanba, 09:00",
    payload: "Haftalik hisobot, Excel",
    icon: CalendarRange,
    accent: "bg-accent-green",
    active: true,
  },
  {
    id: "hududiy",
    recipient: "Hududiy elektr tarmoqlari AJ",
    cadence: "Har oyning 1-sanasi, 10:00",
    payload: "Oylik hisobot, Excel + PDF",
    icon: CalendarFold,
    accent: "bg-accent-purple",
    active: true,
  },
  {
    id: "vazirlik",
    recipient: "Energetika vazirligi",
    cadence: "Har yil, 5-yanvar",
    payload: "Yillik hisobot, PDF",
    icon: CalendarCheck,
    accent: "bg-accent-indigo",
    active: true,
  },
  {
    id: "dispetcher",
    recipient: "Navbatchi dispetcher",
    cadence: "Har kuni, 20:00",
    payload: "Kunlik hisobot, Excel",
    icon: Clock,
    accent: "bg-accent-teal",
    active: true,
  },
  {
    id: "moliya",
    recipient: "Tuman moliya bo’limi",
    cadence: "Har chorak, 12:00",
    payload: "Oylik hisobot, Excel",
    icon: Building2,
    accent: "bg-accent-brown",
    active: false,
  },
];

const ACTIVE_SCHEDULES = SCHEDULES.filter((item) => item.active).length;

const RECENT_COLUMNS: TableColumn[] = [
  { key: "name", label: "Nomi", grow: 3, align: "left" },
  { key: "period", label: "Davr", grow: 1 },
  { key: "format", label: "Format", grow: 1 },
  { key: "size", label: "Hajmi", grow: 1 },
  { key: "date", label: "Sana", grow: 1.4 },
  { key: "author", label: "Yuklab olgan", grow: 1.6 },
];

/** Filtr "Barchasi" ni ham qamrab oladi, shuning uchun alohida tip. */
type PeriodFilter = "all" | ReportPeriod;

const PERIOD_CHIPS: ReadonlyArray<FilterChip<PeriodFilter>> = [
  { value: "all", label: "Barchasi", count: RECENT_REPORTS.length },
  ...REPORT_PERIODS.map((id) => ({
    value: id,
    label: PERIOD_LABEL[id],
    count: RECENT_REPORTS.filter((report) => report.period === id).length,
  })),
];

/**
 * "Hisobotlar" sahifasi.
 *
 * Fayllar loyihadagi mavjud generatorga (`GET /api/reports`) murojaat qiladi:
 * har bir plitkadagi tugma - oddiy `<a download>` havolasi, javobda
 * `Content-Disposition: attachment` bo'lgani uchun brauzer faylni saqlaydi.
 * Shu sababli yuklab olish uchun holat ham, `fetch` ham kerak emas.
 *
 * Balandlik qat'iy taqsimlangan (1064px ish maydoni):
 * 56 (yo'lak) + 104 (statistika) + 300 (yuklab olish) + qolgani pastki qator;
 * oraliqlar 8px. Skroll faqat kartalar ichida bo'ladi, sahifada emas.
 */
export function ReportsView() {
  const [filter, setFilter] = useState<PeriodFilter>("all");

  const rows =
    filter === "all"
      ? RECENT_REPORTS
      : RECENT_REPORTS.filter((report) => report.period === filter);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader
        title="Hisobotlar"
        subtitle="Kunlik, haftalik, oylik va yillik hisobotlarni shakllantirish"
      >
        <HeaderButton icon={Settings2} href="/settings">
          Jo&rsquo;natish sozlamalari
        </HeaderButton>
      </PageHeader>

      <StatRow>
        <StatCard
          label="Tayyor shablon"
          value={num(REPORT_PERIODS.length)}
          unit="ta"
          icon={FileText}
          accent="bg-accent-blue"
          tint="bg-tint-blue"
          hint="Kunlik, haftalik, oylik, yillik"
        />
        <StatCard
          label="Bu oyda yuklab olingan"
          value={num(MONTHLY_DOWNLOADS)}
          unit="ta"
          icon={Download}
          accent="bg-accent-green"
          tint="bg-tint-green"
          hint={`O’tgan oyga nisbatan +${num(DOWNLOADS_DELTA)} ta`}
          hintTone="good"
        />
        <StatCard
          label="Oxirgi hisobot"
          value={TODAY}
          icon={CalendarClock}
          accent="bg-accent-purple"
          tint="bg-tint-purple"
          hint={`Kunlik hisobot · ${TODAY_TIME}`}
        />
        <StatCard
          label="Avtomatik jo’natish"
          value="Yoqilgan"
          icon={Send}
          accent="bg-accent-teal"
          tint="bg-tint-teal"
          hint={`${num(ACTIVE_SCHEDULES)} ta rejalashtirilgan jo’natma`}
        />
      </StatRow>

      {/* Yuklab olish plitkalari - balandligi qat'iy, pastki qator esa qolgan
          joyni egallaydi. */}
      {/* 300px - plitkalar uchun ajratilgan qat'iy qator. `!` shart: `cn()`
          Tailwind sinflarini birlashtirmaydi, `Card` dagi asosiy `h-full`
          esa CSS da keyinroq turadi va aks holda ustun kelardi. */}
      <Card className="h-[300px]! shrink-0">
        <CardHeader title="Hisobot yuklab olish" titleClassName="text-black">
          <span className="text-[11px] text-ink-soft">
            Fayl so&rsquo;rov yuborilishi bilan shakllanadi
          </span>
        </CardHeader>

        <CardBody>
          <div className="grid min-h-0 flex-1 grid-cols-4 gap-2">
            {PERIOD_TILES.map((tile) => (
              <div
                key={tile.id}
                className="flex min-w-0 flex-col rounded-xl border border-solid border-[#dddddd] bg-canvas p-3"
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg text-white",
                    tile.accent,
                  )}
                >
                  <Icon icon={tile.icon} size={22} />
                </span>

                <span className="mt-2.5 truncate text-sm font-bold text-ink">
                  {PERIOD_LABEL[tile.id]} hisobot
                </span>
                {/* `flex-1` izohni cho'zadi - shu sababli tugmalar to'rtala
                    plitkada bir chiziqda, plitka pastida turadi. */}
                <p className="mt-1 flex-1 text-[11px] leading-4 text-ink-soft">
                  {tile.hint}
                </p>

                <div className="mt-2 grid h-10 shrink-0 grid-cols-2 gap-2">
                  {FORMATS.map((format) => (
                    <a
                      key={format.id}
                      href={`/api/reports?period=${tile.id}&format=${format.id}`}
                      download
                      aria-label={`${PERIOD_LABEL[tile.id]} hisobotni ${format.label} sifatida yuklab olish`}
                      className={cn(
                        "flex min-w-0 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-80",
                        format.tone,
                      )}
                    >
                      <format.Mark width={18} height={18} />
                      {format.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-2">
        <Card className="col-span-8 min-h-0">
          <CardHeader title="So&rsquo;nggi hisobotlar">
            <span className="text-[11px] text-ink-soft">{num(rows.length)} ta yozuv</span>
          </CardHeader>
          <CardBody>
            <div className="flex shrink-0 items-center gap-2 pb-3">
              <FilterChips items={PERIOD_CHIPS} value={filter} onChange={setFilter} />
            </div>

            {/* Jadval karta ichida skroll qilinadi - qatorlar soni filtrga
                qarab o'zgarganda ham karta chegarasidan chiqmaydi. */}
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
              <DataTable
                columns={RECENT_COLUMNS}
                rowHeight={38}
                lastRowHeight={42}
                rows={rows.map((report) => ({
                  key: report.id,
                  cells: [
                    <span key="name" className="truncate font-medium text-ink">
                      {report.name}
                    </span>,
                    PERIOD_LABEL[report.period],
                    <Badge key="format" tone={report.format === "pdf" ? "red" : "green"}>
                      {report.format === "pdf" ? "PDF" : "Excel"}
                    </Badge>,
                    report.size,
                    <span key="date" className="text-ink-muted">
                      {report.date}
                    </span>,
                    report.author,
                  ],
                }))}
              />
            </div>
          </CardBody>
        </Card>

        <Card className="col-span-4 min-h-0">
          <CardHeader title="Rejalashtirilgan jo&rsquo;natmalar">
            <span className="text-[11px] text-ink-soft">{num(ACTIVE_SCHEDULES)} ta faol</span>
          </CardHeader>
          <CardBody>
            <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto scrollbar-none">
              {SCHEDULES.map((item) => (
                <li
                  key={item.id}
                  className="flex shrink-0 items-center gap-3 rounded-lg bg-canvas p-3"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg text-white",
                      item.accent,
                    )}
                  >
                    <Icon icon={item.icon} size={18} />
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-xs font-semibold text-ink">
                      {item.recipient}
                    </span>
                    <span className="truncate text-[10px] text-ink-soft">
                      {item.cadence} &middot; {item.payload}
                    </span>
                  </div>

                  {/* `Badge` o'zi `flex` konteyner - qatorda siqilib ketmasligi
                      uchun `shrink-0` o'ramchi kerak. */}
                  <span className="shrink-0">
                    <Badge tone={item.active ? "green" : "amber"}>
                      {item.active ? "Faol" : "To’xtatilgan"}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
