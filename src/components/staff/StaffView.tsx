"use client";

// Qidiruv maydoni, lavozim filtri va nivo halqasi holat/brauzer API talab
// qiladi - shuning uchun butun ko'rinish mijoz komponenti. `page.tsx` esa
// server bo'lib qoladi (u yerda `metadata` eksport qilinadi).

import { ResponsivePie } from "@nivo/pie";
import { Moon, Network, Plus, ShieldCheck, Sun, Sunset, TreePalm, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/DataTable";
import { FilterChips, SearchField } from "@/components/ui/Filters";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/InfoGrid";
import { HeaderButton, PageHeader } from "@/components/ui/PageHeader";
import {
  type RegistryColumn,
  type RegistryRow,
  RegistryTable,
} from "@/components/ui/RegistryTable";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import { between, dec, num, TODAY } from "@/lib/data/seed";
import { SUBSTATIONS } from "@/lib/data/substations";
import { cn } from "@/lib/ui/cn";

/* ---------------------------------------------------------------------------
   Lug'atlar
   --------------------------------------------------------------------------- */

/** Xodim toifasi - filtr tugmalari aynan shu bo'yicha ishlaydi. */
type StaffRole = "engineer" | "inspector" | "master" | "operator";

const ROLE_LABEL: Record<StaffRole, string> = {
  engineer: "Muhandis",
  master: "Usta",
  inspector: "Nazoratchi",
  operator: "Operator",
};

/** Xodimning bugungi holati. */
type StaffStatus = "duty" | "field" | "office" | "vacation";

const STATUS_LABEL: Record<StaffStatus, string> = {
  duty: "Navbatchilikda",
  field: "Hududda",
  office: "Ofisda",
  vacation: "Ta’tilda",
};

const STATUS_TONE: Record<StaffStatus, BadgeTone> = {
  duty: "green",
  field: "blue",
  office: "purple",
  vacation: "amber",
};

/**
 * Korxona bo'limlari. Rang ikki ko'rinishda saqlanadi: `bar` - Tailwind
 * tokeni (ProgressBar va legenda nuqtasi uchun), `color` - aynan hex, chunki
 * nivo SVG ichida CSS o'zgaruvchisini o'qiy olmaydi.
 */
const DEPARTMENTS = [
  { id: "tech", label: "Texnik xizmat", color: "#3b82f6", bar: "bg-accent-blue" },
  { id: "dispatch", label: "Dispetcherlik", color: "#6155f5", bar: "bg-accent-indigo" },
  { id: "metering", label: "Hisob va nazorat", color: "#22c55e", bar: "bg-accent-green" },
  { id: "repair", label: "Ta’mirlash", color: "#f59e0b", bar: "bg-accent-amber" },
  { id: "relay", label: "Rele himoyasi", color: "#cb30e0", bar: "bg-accent-purple" },
  { id: "subscriber", label: "Abonent bo’limi", color: "#14b8a6", bar: "bg-accent-teal" },
] as const;

type DepartmentId = (typeof DEPARTMENTS)[number]["id"];

/**
 * Bosh harflar doirasining rangi. Avatar rasmi o'rniga ishlatiladi -
 * xodim indeksiga qarab tsiklik tanlanadi, shuning uchun ro'yxat qayta
 * chizilganda ham rang o'zgarmaydi.
 */
const SWATCHES = [
  "bg-tint-blue text-accent-blue",
  "bg-tint-green text-accent-green",
  "bg-tint-purple text-accent-purple",
  "bg-tint-indigo text-accent-indigo",
  "bg-tint-amber text-accent-amber",
  "bg-tint-teal text-accent-teal",
  "bg-tint-brown text-accent-brown",
  "bg-tint-red text-accent-red",
] as const;

/* ---------------------------------------------------------------------------
   Maket ma'lumotlari
   --------------------------------------------------------------------------- */

interface StaffMember {
  id: string;
  name: string;
  /** "Karimov Egamberdi" -> "KE". */
  initials: string;
  position: string;
  role: StaffRole;
  departmentId: DepartmentId;
  department: string;
  status: StaffStatus;
  phone: string;
  /** `tel:` sxemasi bo'shliqlarni qabul qilmaydi. */
  tel: string;
  /** Biriktirilgan PS/TP obyektlari soni. */
  objects: number;
  /** Ish staji, yil. */
  experience: number;
  swatch: string;
}

/**
 * Ro'yxatning "suyagi". Birinchi sakkiz nom ataylab `SUBSTATIONS` va
 * `TRANSFORMERS` dagi `responsible` qiymatlari bilan bir xil - detal
 * sahifalaridagi mas'ul xodim shu ro'yxatdan topilishi kerak.
 */
const BASE: ReadonlyArray<{
  name: string;
  position: string;
  role: StaffRole;
  departmentId: DepartmentId;
  status: StaffStatus;
}> = [
  { name: "Karimov Egamberdi", position: "Bosh muhandis", role: "engineer", departmentId: "tech", status: "duty" },
  { name: "Yusupov Sardor", position: "Uchastka ustasi", role: "master", departmentId: "repair", status: "field" },
  { name: "Tursunov Bekzod", position: "Rele muhandisi", role: "engineer", departmentId: "relay", status: "office" },
  { name: "Aliyev Jasur", position: "Nazoratchi", role: "inspector", departmentId: "metering", status: "field" },
  { name: "Nazarov Oybek", position: "Dispetcher-operator", role: "operator", departmentId: "dispatch", status: "duty" },
  { name: "Rahimov Shuhrat", position: "Elektromontyor ustasi", role: "master", departmentId: "tech", status: "field" },
  { name: "Sobirov Dilshod", position: "Bosh nazoratchi", role: "inspector", departmentId: "metering", status: "office" },
  { name: "Ergashev Ulug’bek", position: "Tarmoq muhandisi", role: "engineer", departmentId: "tech", status: "vacation" },
  { name: "Umarov Jahongir", position: "Uchastka ustasi", role: "master", departmentId: "repair", status: "duty" },
  { name: "Xolmatov Anvar", position: "Smena operatori", role: "operator", departmentId: "dispatch", status: "office" },
  { name: "Qodirov Sanjar", position: "Nazoratchi", role: "inspector", departmentId: "subscriber", status: "field" },
  { name: "Mirzayev Akmal", position: "Rele muhandisi", role: "engineer", departmentId: "relay", status: "office" },
  { name: "Toshpo’latov Islom", position: "Elektromontyor ustasi", role: "master", departmentId: "repair", status: "field" },
  { name: "Saidov Nodirbek", position: "Dispetcher-operator", role: "operator", departmentId: "dispatch", status: "duty" },
  { name: "Abdullayev Shohruh", position: "Nazoratchi", role: "inspector", departmentId: "subscriber", status: "vacation" },
  { name: "Ismoilov Farrux", position: "Hisob muhandisi", role: "engineer", departmentId: "metering", status: "field" },
  { name: "Xasanov Zafar", position: "Uchastka ustasi", role: "master", departmentId: "tech", status: "office" },
  { name: "Muhammadiyev Otabek", position: "Smena dispetcheri", role: "operator", departmentId: "dispatch", status: "field" },
];

/** Familiya va ismning bosh harflari - avatar doirasidagi yozuv. */
function initialsOf(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");
}

/**
 * Telefon, obyektlar soni va staj `seed.ts` orqali **determinlashgan**
 * tarzda hisoblanadi: server va mijoz bir xil markup chizishi shart.
 */
const STAFF: readonly StaffMember[] = BASE.map((base, index) => {
  const seed = index + 1;
  const department = DEPARTMENTS.find((item) => item.id === base.departmentId);
  const phone = `+998 ${between(seed * 3.7, 90, 99, 1)} ${between(seed * 5.3, 100, 999, 1)} ${between(seed * 7.1, 10, 99, 1)} ${between(seed * 11.3, 10, 99, 1)}`;

  return {
    id: `st-${String(index + 1).padStart(3, "0")}`,
    name: base.name,
    initials: initialsOf(base.name),
    position: base.position,
    role: base.role,
    departmentId: base.departmentId,
    department: department?.label ?? "",
    status: base.status,
    phone,
    tel: `tel:${phone.replace(/\s/g, "")}`,
    // Ta'tildagi xodimga yangi obyekt biriktirilmaydi - shuning uchun kamroq.
    objects: between(seed * 13.9, 2, base.status === "vacation" ? 6 : 16, 1),
    experience: between(seed * 17.3, 2, 27, 1),
    swatch: SWATCHES[index % SWATCHES.length],
  };
});

const TOTAL_OBJECTS = STAFF.reduce((sum, person) => sum + person.objects, 0);
const ON_DUTY = STAFF.filter((person) => person.status === "duty").length;
const ON_VACATION = STAFF.filter((person) => person.status === "vacation").length;

/** Bo'limlar kesimi - halqa va ProgressBar ro'yxati shu massivdan chiziladi. */
const DEPARTMENT_STATS = DEPARTMENTS.map((department) => {
  const count = STAFF.filter((person) => person.departmentId === department.id).length;
  return { ...department, count, share: (count / STAFF.length) * 100 };
});

/** Nivo uchun bo'laklar - `colors={{ datum: "data.color" }}` shu maydonni o'qiydi. */
interface DepartmentSlice {
  id: string;
  label: string;
  value: number;
  color: string;
}

const DEPARTMENT_SLICES: readonly DepartmentSlice[] = DEPARTMENT_STATS.map((department) => ({
  id: department.id,
  label: department.label,
  value: department.count,
  color: department.color,
}));

/**
 * Bugungi navbatchilik. Xodim `STAFF` dan indeks bo'yicha, hudud esa
 * `SUBSTATIONS` dan olinadi - shunda jadval haqiqiy obyekt nomlarini
 * ko'rsatadi va ma'lumot ikki joyda takrorlanmaydi.
 */
const DUTY_SHIFTS: ReadonlyArray<{
  key: string;
  icon: GlyphIcon;
  time: string;
  tile: string;
  staffIndex: number;
  areaIndex: number;
}> = [
  { key: "day", icon: Sun, time: "08:00–16:00", tile: "bg-tint-amber text-accent-amber", staffIndex: 0, areaIndex: 0 },
  { key: "evening", icon: Sunset, time: "16:00–00:00", tile: "bg-tint-indigo text-accent-indigo", staffIndex: 4, areaIndex: 4 },
  { key: "night", icon: Moon, time: "00:00–08:00", tile: "bg-tint-blue text-accent-blue", staffIndex: 8, areaIndex: 9 },
];

const DUTY_ROWS = DUTY_SHIFTS.map((shift) => ({
  key: shift.key,
  icon: shift.icon,
  time: shift.time,
  tile: shift.tile,
  name: STAFF[shift.staffIndex].name,
  area: SUBSTATIONS[shift.areaIndex].area,
}));

/* ---------------------------------------------------------------------------
   Jadval
   --------------------------------------------------------------------------- */

const COLUMNS: RegistryColumn[] = [
  { key: "name", label: "F.I.O", grow: 22, align: "left" },
  { key: "position", label: "Lavozim", grow: 16, align: "left" },
  { key: "department", label: "Bo’lim", grow: 16, align: "left" },
  { key: "phone", label: "Telefon", grow: 14 },
  { key: "objects", label: "Obyektlar", grow: 10 },
  { key: "experience", label: "Tajriba", grow: 10 },
  { key: "status", label: "Holat", grow: 12 },
];

type RoleFilter = StaffRole | "all";

/** Filtr tugmasidagi son - shu toifadagi xodimlar soni. */
function countRole(role: StaffRole): number {
  return STAFF.filter((person) => person.role === role).length;
}

const ROLE_FILTERS: ReadonlyArray<{ value: RoleFilter; label: string; count: number }> = [
  { value: "all", label: "Barchasi", count: STAFF.length },
  { value: "engineer", label: ROLE_LABEL.engineer, count: countRole("engineer") },
  { value: "master", label: ROLE_LABEL.master, count: countRole("master") },
  { value: "inspector", label: ROLE_LABEL.inspector, count: countRole("inspector") },
  { value: "operator", label: ROLE_LABEL.operator, count: countRole("operator") },
];

/* ---------------------------------------------------------------------------
   Ko'rinish
   --------------------------------------------------------------------------- */

export function StaffView() {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");

  const rows = useMemo<RegistryRow[]>(() => {
    const needle = query.trim().toLowerCase();

    return STAFF.filter((person) => {
      if (role !== "all" && person.role !== role) return false;
      if (!needle) return true;
      // Qidiruv ism, lavozim, bo'lim va telefon bo'yicha - foydalanuvchi
      // qaysi ustunni eslasa, o'shani yozishi mumkin.
      return (
        person.name.toLowerCase().includes(needle) ||
        person.position.toLowerCase().includes(needle) ||
        person.department.toLowerCase().includes(needle) ||
        person.phone.includes(needle)
      );
    }).map((person) => ({
      key: person.id,
      cells: [
        // Avatar rasmi yo'q - o'rniga bosh harflar va indeksga bog'langan rang.
        <span key="name" className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
              person.swatch,
            )}
          >
            {person.initials}
          </span>
          <span className="min-w-0 truncate font-medium text-ink">{person.name}</span>
        </span>,
        <span key="position" className="truncate text-ink-muted">
          {person.position}
        </span>,
        <span key="department" className="truncate text-ink-muted">
          {person.department}
        </span>,
        <a
          key="phone"
          href={person.tel}
          className="truncate text-[11px] text-brand transition-opacity hover:opacity-70"
        >
          {person.phone}
        </a>,
        <span key="objects" className="font-semibold text-ink">
          {num(person.objects)}
        </span>,
        <span key="experience" className="text-ink-muted">
          {`${num(person.experience)} yil`}
        </span>,
        <Badge key="status" tone={STATUS_TONE[person.status]}>
          {STATUS_LABEL[person.status]}
        </Badge>,
      ],
    }));
  }, [query, role]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader
        title={"Ma’sul xodimlar"}
        subtitle={"Tuman elektr tarmoqlari korxonasi xodimlari"}
      >
        <HeaderButton icon={Plus} tone="brand">
          Yangi xodim
        </HeaderButton>
      </PageHeader>

      <StatRow>
        <StatCard
          label="Jami xodim"
          value={num(STAFF.length)}
          unit="nafar"
          icon={Users}
          accent="bg-accent-blue"
          tint="bg-tint-blue"
          hint={`${num(DEPARTMENTS.length)} ta bo’lim bo’yicha taqsimlangan`}
        />
        <StatCard
          label="Navbatchilikda"
          value={num(ON_DUTY)}
          unit="nafar"
          icon={ShieldCheck}
          accent="bg-accent-green"
          tint="bg-tint-green"
          hint={"Bugungi uchala smena to’liq qoplangan"}
          hintTone="good"
        />
        <StatCard
          label={"Ta’tilda"}
          value={num(ON_VACATION)}
          unit="nafar"
          icon={TreePalm}
          accent="bg-accent-amber"
          tint="bg-tint-amber"
          // `TODAY` - "bugun", kelgusi ta’til sanasi emas. Shuning uchun izoh
          // ro'yxat qaysi kun holatiga tuzilganini bildiradi.
          hint={`Ro’yxat ${TODAY} holatiga`}
        />
        <StatCard
          label="Biriktirilgan obyekt"
          value={num(TOTAL_OBJECTS)}
          unit="ta"
          icon={Network}
          accent="bg-accent-indigo"
          tint="bg-tint-indigo"
          hint={"Podstansiya va transformator punktlari"}
        />
      </StatRow>

      {/* Qator balandligi ataylab `minmax(0,1fr)`: aks holda avtomatik qator
          jadval kontenti bo'yicha cho'zilib, sahifa skroll bo'lib ketardi. */}
      <div className="grid min-h-0 flex-1 grid-cols-12 grid-rows-[minmax(0,1fr)] gap-2">
        <Card className="col-span-8 min-h-0">
          <div className="flex shrink-0 items-center gap-2 pb-3">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={"Xodim, lavozim yoki bo’lim..."}
              label={"Xodimlar ro’yxatidan qidirish"}
              className="w-[240px]"
            />
            <FilterChips items={ROLE_FILTERS} value={role} onChange={setRole} />
            <span className="ml-auto shrink-0 text-[11px] text-ink-soft">
              {num(rows.length)} ta yozuv
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
            <RegistryTable
              columns={COLUMNS}
              rows={rows}
              emptyText={"Bunday xodim topilmadi"}
            />
          </div>
        </Card>

        {/* Balandlik kartaga emas, USTUNGA beriladi.

            `Card` ning o'z sinflari orasida `h-full` bor va Tailwind uni
            CSS da balandlik utilitalaridan KEYIN chiqaradi - shuning uchun
            kartaga `h-70` yoki `h-[280px]` berish ish bermaydi, `h-full`
            baribir yengadi va karta ustunning butun bo'yiga cho'zilib,
            ichidagi smenalar 267px gacha kerilib ketardi. Grid qatori esa
            `h-full` uchun ANIQ balandlik beradi: 280px + qolgani. */}
        <div className="col-span-4 grid min-h-0 grid-rows-[280px_minmax(0,1fr)] gap-2">
          <Card>
            <CardHeader title="Navbatchilik jadvali">
              <span className="shrink-0 text-[10px] font-medium text-ink-soft">{TODAY}</span>
            </CardHeader>

            <CardBody>
              {/* Uchala smena tanani teng bo'lishadi - karta balandligi
                  o'zgarsa ham qatorlar toshib ketmaydi. */}
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                {DUTY_ROWS.map((shift) => (
                  <div
                    key={shift.key}
                    className="flex min-h-0 flex-1 items-center gap-3 rounded-lg bg-canvas px-3"
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        shift.tile,
                      )}
                    >
                      <Icon icon={shift.icon} size={16} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-ink">
                        {shift.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-ink-soft">
                        {shift.area}
                      </span>
                    </div>

                    <span className="shrink-0 text-[11px] font-bold text-ink tabular-nums">
                      {shift.time}
                    </span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card className="min-h-0">
            <CardHeader title={"Bo’limlar bo’yicha taqsimot"} />

            <CardBody>
              {/* Halqa balandligi qat'iy: ostidagi ro'yxat qolgan joyni oladi. */}
              <div className="relative h-[190px] shrink-0">
                {/* Karta `overflow-hidden` bo'lgani uchun nivo tultipi
                    kesilardi - legenda o'rnini bosgani sabab o'chirilgan. */}
                <ResponsivePie<DepartmentSlice>
                  data={DEPARTMENT_SLICES}
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
                  <span className="text-xl leading-none font-bold text-ink">
                    {num(STAFF.length)}
                  </span>
                  <span className="mt-1 text-[10px] text-ink-soft">nafar xodim</span>
                </div>
              </div>

              <div className="mt-3 flex min-h-0 flex-1 flex-col justify-center gap-3">
                {DEPARTMENT_STATS.map((department) => (
                  <div key={department.id} className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={cn("size-2 shrink-0 rounded-full", department.bar)} />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-ink-muted">
                        {department.label}
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold text-ink">
                        {num(department.count)} ta
                      </span>
                      <span className="shrink-0 text-[10px] text-ink-soft">
                        {dec(department.share)}%
                      </span>
                    </div>
                    <ProgressBar
                      value={department.share}
                      tone={department.bar}
                      className="mt-1.5"
                    />
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
