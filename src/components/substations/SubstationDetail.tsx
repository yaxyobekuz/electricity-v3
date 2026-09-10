"use client";

// Kartalardagi grafiklar @nivo bilan chiziladi (faqat mijozda ishlaydi) -
// shuning uchun detal ko'rinishi mijoz komponenti, marshrut `page.tsx` esa
// server bo'lib qoladi (metadata, `notFound`, statik prerender).

import { ResponsiveBar } from "@nivo/bar";
import { ResponsivePie } from "@nivo/pie";
import { Gauge, MapPin, PlugZap, Zap, ZapOff } from "lucide-react";

import { Card, CardBody, CardFooterLink, CardHeader } from "@/components/ui/Card";
import {
  Badge,
  type BadgeTone,
  DataTable,
  type TableColumn,
} from "@/components/ui/DataTable";
import { InfoGrid, type InfoItem, ProgressBar } from "@/components/ui/InfoGrid";
import { HeaderButton, PageHeader } from "@/components/ui/PageHeader";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import { substationSubscriberCount, transformerCount } from "@/lib/data/relations";
import { between, dec, energy, MONTHS_SHORT_UZ, MONTHS_UZ, num } from "@/lib/data/seed";
import {
  SUBSTATION_STATUS_LABEL,
  type Substation,
  type SubstationStatus,
} from "@/lib/data/substations";
import {
  TRANSFORMER_STATUS_LABEL,
  type TransformerStatus,
  transformersOfSubstation,
} from "@/lib/data/transformers";
import { cn } from "@/lib/ui/cn";

const STATUS_TONE: Record<SubstationStatus, BadgeTone> = {
  active: "green",
  maintenance: "amber",
  fault: "red",
};

/** Transformator holati -> nishon rangi ("O'chirilgan" - neytral ko'k). */
const TRANSFORMER_TONE: Record<TransformerStatus, BadgeTone> = {
  ok: "green",
  warning: "amber",
  critical: "red",
  offline: "blue",
};

/** Yuklama rangi - ro'yxat sahifasidagi chegaralar bilan bir xil. */
function loadTone(load: number): string {
  if (load > 90) return "bg-accent-red";
  if (load > 75) return "bg-accent-amber";
  return "bg-accent-green";
}

/** Yuklama kartasining yumshoq foni - chiziq rangiga mos. */
function loadTint(load: number): string {
  if (load > 90) return "bg-tint-red";
  if (load > 75) return "bg-tint-amber";
  return "bg-tint-green";
}

const TRANSFORMER_COLUMNS: TableColumn[] = [
  { key: "code", label: "Kod", grow: 12, align: "left" },
  { key: "status", label: "Holat", grow: 14 },
  { key: "power", label: "Quvvat, kVA", grow: 12 },
  { key: "load", label: "Yuklama", grow: 10 },
  { key: "consumption", label: "Iste’mol", grow: 14 },
  { key: "loss", label: "Yo’qotish", grow: 10 },
];

/**
 * O'q yorliqlari. `MONTHS_SHORT_UZ` da Iyun ham, Iyul ham "Iyu" bo'lib
 * qoladi - nivo esa indeks qiymatlarining noyobligini talab qiladi (aks
 * holda ikki oy bitta ustunga birlashib ketadi), shuning uchun shu ikkitasi
 * ajratiladi.
 */
const AXIS_MONTHS = MONTHS_SHORT_UZ.map((short, index) => {
  if (index === 5) return "Iyn";
  if (index === 6) return "Iyl";
  return short;
});

/** Grafiklarning umumiy uslubi - o'q matni 10px, to'r ochiq kulrang. */
const CHART_THEME = {
  text: { fontFamily: "inherit", fontSize: 10, fill: "#767676" },
  axis: {
    ticks: { text: { fontFamily: "inherit", fontSize: 10, fill: "#767676" } },
    domain: { line: { stroke: "transparent" } },
  },
  grid: { line: { stroke: "#f0f0f0" } },
} as const;

interface LossSlice {
  id: string;
  label: string;
  /** Halqa yoyining o'lchami, kWh. */
  value: number;
  /** Legendadagi tayyor matn. */
  display: string;
  /** Umumiy iste'moldagi ulush, foizda. */
  share: string;
  /** Nivo SVG ichida CSS o'zgaruvchisi o'qilmaydi - aynan hex saqlanadi. */
  color: string;
}

/**
 * Yo'qotish tuzilmasi ("ps-007" -> 7 seed'i asosida determinlashgan):
 * texnik yo'qotish doim ustun, hisobsiz iste'mol eng kichik ulush.
 * Uchala ulush yig'indisi doim 1 ga teng, ya'ni umumiy `lossPercent` saqlanadi.
 */
function lossSlices(substation: Substation, lossKwh: number): LossSlice[] {
  const seed = Number.parseInt(substation.id.slice(3), 10) || 1;
  const technical = between(seed * 3.3, 50, 62, 1) / 100;
  const commercial = between(seed * 7.7, 24, 32, 1) / 100;

  return [
    { id: "technical", label: "Texnik yo’qotish", share: technical, color: "#3b82f6" },
    { id: "commercial", label: "Tijorat yo’qotishi", share: commercial, color: "#f59e0b" },
    {
      id: "unmetered",
      label: "Hisobsiz iste’mol",
      share: 1 - technical - commercial,
      color: "#ff383c",
    },
  ].map((part) => {
    const value = Math.round(lossKwh * part.share);
    return {
      id: part.id,
      label: part.label,
      value,
      display: energy(value),
      share: `${dec(substation.lossPercent * part.share)}%`,
      color: part.color,
    };
  });
}

/**
 * `StatCard` izohi `<p>` ichida chiziladi, `<p>` esa `<div>` ni saqlay
 * olmaydi (React DOM nesting ogohlantirishi va gidratatsiya farqi) -
 * shuning uchun bu yerda `ProgressBar` emas, `span` lardan yasalgan chiziq.
 */
function LoadHint({ load }: { load: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/10">
        <span
          className={cn("block h-full rounded-full", loadTone(load))}
          style={{ width: `${load}%` }}
        />
      </span>
      <span className="shrink-0">Zaxira {dec(100 - load, 0)}%</span>
    </span>
  );
}

/**
 * Podstansiya detal sahifasi.
 *
 * Balandlik: yo'lak 56 + ko'rsatkichlar 104 + uch qatorli grid. Qatorlar
 * `minmax(Npx, Nfr)` - 1064px ish maydonida mutanosib cho'ziladi, pastroq
 * ekranda esa eng kichik balandlikda qolib, sahifa skroll bo'ladi.
 */
export function SubstationDetail({ substation }: { substation: Substation }) {
  // Eng yuklangan transformator birinchi bo'lsin - dispetcher shunga qaraydi.
  const transformers = [...transformersOfSubstation(substation.id)].sort(
    (a, b) => b.loadPercent - a.loadPercent,
  );

  const lossKwh = Math.round((substation.consumptionKwh * substation.lossPercent) / 100);
  const slices = lossSlices(substation, lossKwh);

  // Grafik uchun: o'qda qisqartma, maslahatda to'liq oy nomi ko'rsatiladi.
  const monthly = substation.monthly.map((value, index) => ({
    month: AXIS_MONTHS[index],
    monthFull: MONTHS_UZ[index],
    value,
  }));

  const info: InfoItem[] = [
    { key: "code", label: "Kod", value: substation.code },
    { key: "voltage", label: "Kuchlanish", value: substation.voltage },
    {
      key: "status",
      label: "Holat",
      value: SUBSTATION_STATUS_LABEL[substation.status],
    },
    {
      key: "commissioned",
      label: "Ishga tushirilgan",
      // Yil - ming ajratgichsiz yoziladi, shuning uchun `num` ishlatilmaydi.
      value: `${substation.commissioned}-yil`,
    },
    { key: "feeders", label: "Fiderlar soni", value: `${num(substation.feeders)} ta` },
    {
      key: "transformers",
      label: "Transformatorlar soni",
      value: `${num(transformerCount(substation.id))} ta`,
    },
    {
      key: "subscribers",
      label: "Iste’molchilar soni",
      value: `${num(substationSubscriberCount(substation.id))} ta`,
    },
    {
      key: "loss",
      label: "Yo’qotish ulushi",
      value: `${dec(substation.lossPercent)}%`,
    },
  ];

  const contact: InfoItem[] = [
    { key: "responsible", label: "Mas’ul xodim", value: substation.responsible },
    { key: "phone", label: "Telefon", value: substation.phone },
    { key: "address", label: "Manzil", value: substation.address },
    {
      key: "coords",
      label: "Koordinatalar",
      value: `${dec(substation.lat, 4)}, ${dec(substation.lng, 4)}`,
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto scrollbar-none">
      <PageHeader
        title={substation.name}
        subtitle={`${substation.code} · ${substation.voltage} · ${substation.area}`}
        backHref="/substations"
        backLabel={"Ro’yxatga qaytish"}
      >
        <Badge tone={STATUS_TONE[substation.status]}>
          {SUBSTATION_STATUS_LABEL[substation.status]}
        </Badge>
        <HeaderButton icon={MapPin} href="/map">
          Xaritada
        </HeaderButton>
      </PageHeader>

      <StatRow>
        <StatCard
          label="Joriy yuklama"
          value={dec(substation.loadPercent, 0)}
          unit="%"
          icon={Gauge}
          // Nosoz podstansiyada yuklama 0 - "yashil" ko'rinmasligi uchun
          // karta rangi holatdan olinadi, ko'rsatkichdan emas.
          accent={substation.status === "fault" ? "bg-accent-red" : loadTone(substation.loadPercent)}
          tint={substation.status === "fault" ? "bg-tint-red" : loadTint(substation.loadPercent)}
          hint={
            substation.status === "fault" ? (
              "Nosoz — yuklama berilmayapti"
            ) : (
              <LoadHint load={substation.loadPercent} />
            )
          }
          hintTone={substation.status === "fault" ? "bad" : "flat"}
        />
        <StatCard
          label="Quvvat"
          value={num(substation.capacityMva)}
          unit="MVA"
          icon={Zap}
          accent="bg-accent-indigo"
          tint="bg-tint-indigo"
          hint={`${num(substation.feeders)} ta fider chiqishi`}
        />
        <StatCard
          label="Oylik iste&rsquo;mol"
          value={energy(substation.consumptionKwh)}
          icon={PlugZap}
          accent="bg-accent-teal"
          tint="bg-tint-teal"
          hint={`${num(substationSubscriberCount(substation.id))} ta iste’molchi`}
        />
        <StatCard
          label="Yo&rsquo;qotish"
          value={dec(substation.lossPercent)}
          unit="%"
          icon={ZapOff}
          accent="bg-accent-red"
          tint="bg-tint-red"
          hint={`Oyiga ${energy(lossKwh)}`}
          // 10% - reja bo'yicha yo'qotish chegarasi.
          hintTone={substation.lossPercent > 10 ? "bad" : "good"}
        />
      </StatRow>

      <div className="grid flex-1 grid-cols-12 grid-rows-[minmax(300px,300fr)_minmax(300px,300fr)_minmax(132px,132fr)] gap-2">
        {/* 1-qator: umumiy ma'lumotlar + oylik dinamika */}
        <Card className="col-span-5">
          <CardHeader title="Umumiy ma&rsquo;lumotlar" />
          <CardBody>
            {/* Ro'yxat past ekranda ham kartadan chiqmasligi uchun ichkarida
                skroll qilinadi, yuklama chizig'i esa doim ko'rinib turadi. */}
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
              <InfoGrid items={info} columns={2} />
            </div>
            <div className="mt-3 shrink-0">
              <div className="flex items-center justify-between text-[10px] text-ink-soft">
                <span>Joriy yuklama</span>
                <span className="font-semibold text-ink">
                  {dec(substation.loadPercent, 0)}%
                </span>
              </div>
              <ProgressBar
                value={substation.loadPercent}
                tone={loadTone(substation.loadPercent)}
                className="mt-1.5"
              />
            </div>
          </CardBody>
        </Card>

        <Card className="col-span-7">
          <CardHeader title="Oylik iste&rsquo;mol dinamikasi">
            <span className="text-[10px] text-ink-soft">ming kWh</span>
          </CardHeader>
          <CardBody>
            <div className="min-h-0 flex-1">
              <ResponsiveBar
                data={monthly}
                keys={["value"]}
                indexBy="month"
                margin={{ top: 8, right: 8, bottom: 22, left: 44 }}
                padding={0.32}
                colors={["#007cd2"]}
                borderRadius={4}
                enableLabel={false}
                enableGridX={false}
                axisTop={null}
                axisRight={null}
                axisBottom={{ tickSize: 0, tickPadding: 6 }}
                axisLeft={{
                  tickSize: 0,
                  tickPadding: 6,
                  format: (value: number) => num(value),
                }}
                valueFormat={(value: number) => `${num(value)} ming kWh`}
                theme={CHART_THEME}
                animate={false}
                tooltip={({ data, formattedValue, color }) => (
                  <div className="rounded-md bg-surface px-2 py-1 whitespace-nowrap shadow-md">
                    <div className="text-[9px] text-ink-soft">{data.monthFull}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-semibold">{formattedValue}</span>
                    </div>
                  </div>
                )}
              />
            </div>
          </CardBody>
        </Card>

        {/* 2-qator: ulangan transformatorlar + yo'qotish tuzilmasi */}
        <Card className="col-span-7">
          <CardHeader title="Podstansiyaga ulangan transformatorlar">
            <span className="text-[10px] text-ink-soft">
              {num(transformers.length)} ta yozuv
            </span>
          </CardHeader>
          <CardBody>
            {/* 8 tadan ko'p qator bo'lsa ro'yxat ichkarida skroll qilinadi. */}
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
              {transformers.length === 0 ? (
                <p className="py-8 text-center text-xs text-ink-soft">
                  Bu podstansiyaga transformator biriktirilmagan
                </p>
              ) : (
                <DataTable
                  columns={TRANSFORMER_COLUMNS}
                  rows={transformers.map((item) => ({
                    key: item.id,
                    cells: [
                      <span key="code" className="font-medium">
                        {item.code}
                      </span>,
                      <Badge key="status" tone={TRANSFORMER_TONE[item.status]}>
                        {TRANSFORMER_STATUS_LABEL[item.status]}
                      </Badge>,
                      num(item.powerKva),
                      <span
                        key="load"
                        className={cn(
                          "font-medium",
                          item.loadPercent > 100 ? "text-trend-up" : "text-ink",
                        )}
                      >
                        {dec(item.loadPercent, 0)}%
                      </span>,
                      energy(item.consumptionKwh),
                      `${dec(item.lossPercent)}%`,
                    ],
                  }))}
                />
              )}
            </div>
          </CardBody>
          <CardFooterLink href="/transformers">Barcha transformatorlar</CardFooterLink>
        </Card>

        <Card className="col-span-5">
          <CardHeader title="Yo&rsquo;qotish tuzilmasi" />
          <CardBody>
            <div className="flex min-h-0 flex-1 items-center gap-4">
              {/* Halqa kengligi qat'iy - legenda uni siqib qo'ymaydi. */}
              <div className="relative h-full w-[150px] shrink-0">
                {/* Karta `overflow-hidden` bo'lgani uchun nivo tultipi
                    kesilardi - qiymatlar legendada to'liq ko'rsatiladi. */}
                <ResponsivePie<LossSlice>
                  data={slices}
                  innerRadius={0.66}
                  padAngle={1.2}
                  cornerRadius={2}
                  margin={{ top: 6, right: 6, bottom: 6, left: 6 }}
                  colors={{ datum: "data.color" }}
                  enableArcLabels={false}
                  enableArcLinkLabels={false}
                  isInteractive={false}
                  animate={false}
                />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg leading-none font-bold text-ink">
                    {dec(substation.lossPercent)}%
                  </span>
                  <span className="mt-1 text-[9px] text-ink-soft">jami yo&rsquo;qotish</span>
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
                {slices.map((slice) => (
                  <div key={slice.id} className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: slice.color }}
                    />
                    <div className="min-w-0">
                      <span className="block truncate text-[10px] leading-[13px] text-ink-soft">
                        {slice.label}
                      </span>
                      <div className="mt-0.5 flex items-baseline gap-1">
                        <span className="min-w-0 truncate text-[11px] leading-[14px] font-semibold text-ink">
                          {slice.display}
                        </span>
                        <span className="shrink-0 text-[9px] text-ink-soft">
                          ({slice.share})
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* 3-qator: mas'ul xodim va joylashuv */}
        <Card className="col-span-12">
          <CardHeader title="Mas&rsquo;ul xodim va joylashuv" />
          <CardBody className="justify-center">
            <InfoGrid items={contact} columns={4} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
