"use client";

// Qamrov tanlagichi holat (`useState`) talab qiladi - shuning uchun
// ko'rinish mijozda. Yuklab olish tugmalari oddiy `<a download>` havolalari:
// fayl `/api/reports` da so'rov kelganda shakllanadi.

import { CalendarFold, CalendarRange, Check, Landmark, X } from "lucide-react";
import { type ComponentType, type ReactNode, type SVGProps, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { ExcelMark, PdfMark } from "@/components/ui/icons/BrandMarks";
import { PageHeader } from "@/components/ui/PageHeader";
import { type SelectOption, SelectField } from "@/components/ui/SelectField";
import type { TemplateType } from "@/generated/prisma";
import { num } from "@/lib/format";
import {
  MONTHLY_SERIES_TITLE,
  REPORT_PERIOD_LABEL,
  type ReportFormat,
  type ReportPeriod,
  type ReportScopeKind,
  YEARLY_SERIES_TITLE,
} from "@/lib/reports/types";
import { cn } from "@/lib/ui/cn";

/* ---------------------------------------------------------------------------
   Props
   --------------------------------------------------------------------------- */

export interface ReportEntityOption {
  id: string;
  name: string;
}

export interface ReportFeederOption extends ReportEntityOption {
  substationId: string;
}

export interface ReportTransformerOption extends ReportEntityOption {
  substationId: string;
  feederId: string;
}

/** Shablonning shu oyga yuklangan-yuklanmaganligi. */
export interface ReportTemplateStatus {
  type: TemplateType;
  label: string;
  uploaded: boolean;
}

export interface ReportsViewProps {
  /** Tanlangan oy: kalit, "Sentabr 2026" va "13-sentabr, 2026". */
  period: { key: string; label: string; reportDate: string };
  /** Yillik hisobot qamraydigan oylar (bazadagi, tanlangan oygacha). */
  yearly: { rangeLabel: string; months: number };
  districtName: string;
  /** Shu oyda holati bor obyektlar (fayl tartibida). */
  substations: ReportEntityOption[];
  feeders: ReportFeederOption[];
  transformers: ReportTransformerOption[];
  templates: ReportTemplateStatus[];
  /** `?scope=` dan boshlang'ich tanlov. */
  initial: ScopePick;
}

/** Tanlagichdagi uchta ro'yxatning tanlangan qiymatlari. */
export interface ScopePick {
  substationId: string | null;
  feederId: string | null;
  transformerId: string | null;
}

/* ---------------------------------------------------------------------------
   Lug'atlar
   --------------------------------------------------------------------------- */

interface FormatOption {
  id: ReportFormat;
  label: string;
  Mark: ComponentType<SVGProps<SVGSVGElement>>;
  /** Fon - `DownloadReportsCard` dagi format ranglari bilan bir xil. */
  tone: string;
}

const FORMATS: readonly FormatOption[] = [
  { id: "xlsx", label: "Excel", Mark: ExcelMark, tone: "bg-[#e8f5ef] text-[#107c41]" },
  { id: "pdf", label: "PDF", Mark: PdfMark, tone: "bg-[#f9e6e6] text-[#c80a0a]" },
];

/** Shablon hisobotning qaysi qismini to'ldiradi. */
const TEMPLATE_ROLE: Record<TemplateType, string> = {
  SUBSTATIONS: "Tuman va podstansiya oqimi",
  FEEDERS: "Fider oqimi",
  TRANSFORMERS: "TP oqimi, TP jadvali, abonentlar soni",
  SUBSCRIBERS: "Qarzdorlik",
  VIOLATIONS: "Qoidabuzarliklar bo’limi",
  APPEALS: "Murojaatlar bo’limi",
};

type Scope = { kind: "district" } | { kind: Exclude<ReportScopeKind, "district">; id: string };

/* ---------------------------------------------------------------------------
   Qismlar
   --------------------------------------------------------------------------- */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium text-ink-soft">{label}</span>
      {children}
    </div>
  );
}

interface TileProps {
  period: ReportPeriod;
  icon: GlyphIcon;
  accent: string;
  coverage: string;
  sections: readonly string[];
  query: string;
}

function ReportTile({ period, icon, accent, coverage, sections, query }: TileProps) {
  const label = REPORT_PERIOD_LABEL[period];
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-solid border-[#dddddd] bg-canvas p-4">
      <div className="flex items-center gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg text-white", accent)}>
          <Icon icon={icon} size={22} />
        </span>
        <div className="min-w-0">
          <span className="block truncate text-sm font-bold text-ink">{label} hisobot</span>
          <span className="block truncate text-[11px] text-ink-soft">{coverage}</span>
        </div>
      </div>

      <ol className="mt-3 flex flex-1 list-decimal flex-col gap-1 pl-5 text-[11px] leading-4 text-ink-muted">
        {sections.map((section) => (
          <li key={section}>{section}</li>
        ))}
      </ol>

      <div className="mt-3 grid h-10 shrink-0 grid-cols-2 gap-2">
        {FORMATS.map((format) => (
          <a
            key={format.id}
            href={`/api/reports?period=${period}&format=${format.id}&${query}`}
            download
            aria-label={`${label} hisobotni ${format.label} sifatida yuklab olish`}
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
  );
}

/* ---------------------------------------------------------------------------
   Ko'rinish
   --------------------------------------------------------------------------- */

/**
 * "Hisobotlar" sahifasi: qamrov (tuman / podstansiya / fider / TP) tanlanadi,
 * so'ng oylik yoki yillik hisobot Excel / PDF ko'rinishida yuklab olinadi.
 * Havola: `/api/reports?period=..&format=..&scope=<kind>:<id>&month=<key>`
 * (tuman uchun `scope` yo'q).
 */
export function ReportsView({
  period,
  yearly,
  districtName,
  substations,
  feeders,
  transformers,
  templates,
  initial,
}: ReportsViewProps) {
  const [picked, setPicked] = useState<ScopePick>(initial);

  // Oy almashtirilganda sahifa qayta chiziladi, lekin holat saqlanadi. Shu
  // oyning ro'yxatida yo'q obyekt tanlovdan tushadi - aks holda sarlavha bo'sh,
  // havola esa eski obyektga ketardi. Obyektning ota obyektlari oylar davomida
  // o'zgarmaydi, shuning uchun qolgan tanlov o'zaro mos.
  const substation = substations.find((row) => row.id === picked.substationId) ?? null;
  const feeder = feeders.find((row) => row.id === picked.feederId) ?? null;
  const transformer = transformers.find((row) => row.id === picked.transformerId) ?? null;
  const substationId = substation?.id ?? null;
  const feederId = feeder?.id ?? null;
  const transformerId = transformer?.id ?? null;

  /** "TP-12 (Markaz)" - ota obyekt nomi topilmasa qavssiz. */
  const withParent = (name: string, parent: string | undefined) => (parent ? `${name} (${parent})` : name);

  const substationOptions: SelectOption[] = substations.map((row) => ({ value: row.id, label: row.name }));
  const feederOptions: SelectOption[] = feeders
    .filter((row) => !substationId || row.substationId === substationId)
    .map((row) => ({
      value: row.id,
      label: substationId
        ? row.name
        : withParent(row.name, substations.find((item) => item.id === row.substationId)?.name),
    }));
  const transformerOptions: SelectOption[] = transformers
    .filter((row) => (feederId ? row.feederId === feederId : !substationId || row.substationId === substationId))
    .map((row) => ({
      value: row.id,
      label: feederId ? row.name : withParent(row.name, feeders.find((item) => item.id === row.feederId)?.name),
    }));

  // Har bir tanlovda uchala qiymat birga yoziladi - holatda ko'rinmaydigan
  // (shu oyda yo'q) eski qiymat qolib ketmaydi.
  function chooseSubstation(next: string | null) {
    setPicked({
      substationId: next,
      feederId: next && feeder?.substationId === next ? feederId : null,
      transformerId: next && transformer?.substationId === next ? transformerId : null,
    });
  }

  function chooseFeeder(next: string | null) {
    if (!next) {
      setPicked({ substationId, feederId: null, transformerId: null });
      return;
    }
    const nextFeeder = feeders.find((row) => row.id === next);
    setPicked({
      substationId: nextFeeder?.substationId ?? substationId,
      feederId: next,
      transformerId: transformer?.feederId === next ? transformerId : null,
    });
  }

  function chooseTransformer(next: string | null) {
    const tp = transformers.find((row) => row.id === next);
    setPicked(
      tp
        ? { substationId: tp.substationId, feederId: tp.feederId, transformerId: tp.id }
        : { substationId, feederId, transformerId: null },
    );
  }

  function resetToDistrict() {
    setPicked({ substationId: null, feederId: null, transformerId: null });
  }

  const scope: Scope = transformer
    ? { kind: "transformer", id: transformer.id }
    : feeder
      ? { kind: "feeder", id: feeder.id }
      : substation
        ? { kind: "substation", id: substation.id }
        : { kind: "district" };

  const scopeTitle = transformer
    ? `${transformer.name} transformatori`
    : feeder
      ? `${feeder.name} fideri`
      : substation
        ? `${substation.name} podstansiyasi`
        : districtName;

  // Qamrov obyekt ID lari faqat harf-raqamdan iborat - kodlash shart emas.
  const query = scope.kind === "district" ? `month=${period.key}` : `scope=${scope.kind}:${scope.id}&month=${period.key}`;

  const common = [
    "Transformatorlar jadvali (oqim, yo’qotish ulushi, abonentlar)",
    "Qoidabuzarliklar turi bo’yicha (soni, zarar so’m va kWh)",
    "Murojaatlar holati bo’yicha",
  ];
  const monthlySections = [
    "Umumiy ko’rsatkichlar: 6 ta, o’tgan oy bilan taqqoslash",
    MONTHLY_SERIES_TITLE[scope.kind],
    ...common,
  ];
  const yearlySections = [
    `Umumiy ko’rsatkichlar: ${period.label} holati`,
    // Oylar soni qamrovga bog'liq (obyekt keyinroq paydo bo'lgan bo'lishi mumkin) -
    // shuning uchun son emas, oraliq yoziladi.
    `${YEARLY_SERIES_TITLE}: ${yearly.rangeLabel} (ma’lumoti bor oylar)`,
    ...common.map((section) => `${section} - ${period.label}`),
  ];

  const yearlyCoverage =
    yearly.months < 12
      ? `${yearly.rangeLabel} · bazada ${num(yearly.months)} oy`
      : yearly.rangeLabel;

  const missing = templates.filter((item) => !item.uploaded).length;

  return (
    <div className="scrollbar-none flex h-full min-h-0 flex-col gap-2 overflow-y-auto">
      <PageHeader
        title="Hisobotlar"
        subtitle={`Oylik va yillik hisobotlar · ${period.label} · ${period.reportDate} holatiga`}
      />

      <Card className="h-auto! shrink-0">
        <CardHeader title="Hisobot qamrovi">
          <span className="truncate text-xs font-semibold text-brand">{scopeTitle}</span>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] items-end gap-3">
            <Field label="Tuman">
              <button
                type="button"
                onClick={resetToDistrict}
                aria-pressed={scope.kind === "district"}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  scope.kind === "district" ? "bg-brand text-white" : "bg-canvas text-ink hover:bg-black/5",
                )}
              >
                <Icon icon={Landmark} size={16} />
                {districtName}
              </button>
            </Field>
            <Field label="Podstansiya">
              <SelectField
                value={substationId}
                options={substationOptions}
                placeholder="Barcha podstansiyalar"
                onChange={chooseSubstation}
                disabled={substationOptions.length === 0}
              />
            </Field>
            <Field label="Fider">
              <SelectField
                value={feederId}
                options={feederOptions}
                placeholder="Barcha fiderlar"
                onChange={chooseFeeder}
                disabled={feederOptions.length === 0}
              />
            </Field>
            <Field label="Transformator (TP)">
              <SelectField
                value={transformerId}
                options={transformerOptions}
                placeholder="Barcha TP lar"
                onChange={chooseTransformer}
                disabled={transformerOptions.length === 0}
              />
            </Field>
          </div>
          <p className="pt-2 text-[11px] text-ink-soft">
            Ro’yxatlarda {period.label} oyida ma’lumoti bor obyektlar: {num(substations.length)} ta podstansiya,{" "}
            {num(feeders.length)} ta fider, {num(transformers.length)} ta TP.
          </p>
        </CardBody>
      </Card>

      <div className="grid shrink-0 grid-cols-12 gap-2">
        <Card className="col-span-8">
          <CardHeader title="Hisobot yuklab olish" titleClassName="text-black">
            <span className="truncate text-[11px] text-ink-soft">Fayl so’rov yuborilganda shakllanadi</span>
          </CardHeader>
          <CardBody>
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
              <ReportTile
                period="monthly"
                icon={CalendarFold}
                accent="bg-accent-purple"
                coverage={period.label}
                sections={monthlySections}
                query={query}
              />
              <ReportTile
                period="yearly"
                icon={CalendarRange}
                accent="bg-accent-indigo"
                coverage={yearlyCoverage}
                sections={yearlySections}
                query={query}
              />
            </div>
          </CardBody>
        </Card>

        <Card className="col-span-4">
          <CardHeader title={`${period.label} ma’lumotlari`}>
            <span className={cn("text-[11px]", missing > 0 ? "text-trend-up" : "text-trend-down")}>
              {missing > 0 ? `${num(missing)} ta shablon yuklanmagan` : "Hammasi yuklangan"}
            </span>
          </CardHeader>
          <CardBody>
            <ul className="flex flex-col gap-1.5">
              {templates.map((item) => (
                <li key={item.type} className="flex items-center gap-3 rounded-lg bg-canvas px-3 py-2">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-white",
                      item.uploaded ? "bg-accent-green" : "bg-[#b3b3bb]",
                    )}
                  >
                    <Icon icon={item.uploaded ? Check : X} size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-ink">{item.label}</span>
                    <span className="block truncate text-[10px] text-ink-soft">{TEMPLATE_ROLE[item.type]}</span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-[10px] font-medium",
                      item.uploaded ? "text-trend-down" : "text-ink-soft",
                    )}
                  >
                    {item.uploaded ? "Yuklangan" : "Yuklanmagan"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="pt-2 text-[10px] leading-4 text-ink-soft">
              Yuklanmagan shablonga bog’liq bo’limlar faylda &ldquo;Ma’lumot yuklanmagan&rdquo; deb chiqadi.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
