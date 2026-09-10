"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  Bell,
  Building2,
  Check,
  Database,
  Info,
  KeyRound,
  Laptop,
  MapPin,
  MessageSquare,
  Monitor,
  Plug,
  Save,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  User,
  X,
} from "lucide-react";

import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/DataTable";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { HeaderButton, PageHeader } from "@/components/ui/PageHeader";
import { TODAY, TODAY_TIME, num } from "@/lib/data/seed";
import { cn } from "@/lib/ui/cn";

/* ---------------------------------------------------------------------------
   Bo'limlar ro'yxati
   --------------------------------------------------------------------------- */

type SectionId =
  | "integrations"
  | "norms"
  | "notifications"
  | "organization"
  | "profile"
  | "security";

interface SectionDef {
  id: SectionId;
  label: string;
  icon: GlyphIcon;
  /** Karta sarlavhasining o'ng tarafidagi qisqa izoh. */
  note: string;
}

const SECTIONS: readonly SectionDef[] = [
  {
    id: "profile",
    label: "Profil",
    icon: User,
    note: "Shaxsiy ma\u2019lumotlar va kirish huquqi",
  },
  {
    id: "organization",
    label: "Tashkilot",
    icon: Building2,
    note: "Korxona rekvizitlari va manzili",
  },
  {
    id: "notifications",
    label: "Bildirishnomalar",
    icon: Bell,
    note: "Qaysi hodisalar haqida xabar keladi",
  },
  {
    id: "norms",
    label: "Me\u2019yorlar",
    icon: SlidersHorizontal,
    note: "Tahlil va signallar uchun chegaraviy qiymatlar",
  },
  {
    id: "integrations",
    label: "Integratsiyalar",
    icon: Plug,
    note: "Tashqi xizmatlar bilan ulanish",
  },
  {
    id: "security",
    label: "Xavfsizlik",
    icon: ShieldCheck,
    note: "Parol, ikki bosqichli tasdiq va seanslar",
  },
];

/* ---------------------------------------------------------------------------
   Mock ma'lumotlar - determinlashgan (Math.random / new Date ishlatilmaydi)
   --------------------------------------------------------------------------- */

interface FieldDef {
  key: string;
  label: string;
  value: string;
  /** `true` bo'lsa maydon ikkala ustunni egallaydi (uzun nom, manzil). */
  wide?: boolean;
}

const PROFILE_NAME = "Rahimov Sardor Alisher o\u2019g\u2019li";
/** Avatar uchun bosh harflar - maketda foto yo'q. */
const PROFILE_INITIALS = "RS";

const PROFILE_FIELDS: readonly FieldDef[] = [
  { key: "fullName", label: "F.I.O", value: PROFILE_NAME, wide: true },
  { key: "role", label: "Lavozim", value: "Bosh muhandis" },
  { key: "unit", label: "Bo\u2019lim", value: "Texnik nazorat bo\u2019limi" },
  { key: "email", label: "Elektron pochta", value: "s.rahimov@baliqchi-etk.uz" },
  { key: "phone", label: "Telefon", value: "+998 90 245-18-04" },
  { key: "employeeId", label: "Xodim raqami", value: "ETK-0142" },
  { key: "login", label: "Tizimga kirish nomi", value: "s.rahimov" },
  {
    key: "lastLogin",
    label: "Oxirgi kirish",
    value: `${TODAY} \u00b7 ${TODAY_TIME}`,
  },
];

const ORGANIZATION_FIELDS: readonly FieldDef[] = [
  {
    key: "name",
    label: "Tashkilot nomi",
    value: "Baliqchi tumani elektr tarmoqlari korxonasi",
    wide: true,
  },
  { key: "shortName", label: "Qisqa nomi", value: "Baliqchi ETK" },
  { key: "district", label: "Tuman", value: "Baliqchi tumani" },
  { key: "region", label: "Viloyat", value: "Andijon viloyati" },
  {
    key: "address",
    label: "Manzil",
    value: "Baliqchi tumani, Navoiy ko\u2019chasi, 14-uy",
    wide: true,
  },
  // INN katta son - qo'lda ajratilmaydi, `num` formatlaydi.
  { key: "inn", label: "INN", value: num(302458719) },
  {
    key: "head",
    label: "Rahbar",
    value: "Yo\u2019ldoshev Oybek Toshpo\u2019latovich",
  },
  { key: "phone", label: "Ishonch telefoni", value: "+998 74 421-33-10" },
  { key: "email", label: "Rasmiy pochta", value: "info@baliqchi-etk.uz" },
  {
    key: "schedule",
    label: "Ish vaqti",
    value: "09:00 - 18:00 (dushanba-shanba)",
  },
];

interface NotificationDef {
  id: string;
  title: string;
  note: string;
  /** Boshlang'ich holat - "Bekor qilish" shu qiymatlarga qaytaradi. */
  on: boolean;
}

const NOTIFICATIONS: readonly NotificationDef[] = [
  {
    id: "outage",
    title: "Avariya signallari",
    note: "Fider yoki transformator o\u2019chganda darhol xabar keladi",
    on: true,
  },
  {
    id: "overload",
    title: "Yuklama chegarasi",
    note: "Transformator yuklamasi belgilangan chegaradan oshganda",
    on: true,
  },
  {
    id: "loss",
    title: "Yo\u2019qotish me\u2019yori",
    note: "Oylik yo\u2019qotish me\u2019yordan yuqori bo\u2019lganda",
    on: true,
  },
  {
    id: "report",
    title: "Hisobot tayyor",
    note: "Oylik va choraklik hisobot shakllanib bo\u2019lgach",
    on: false,
  },
  {
    id: "subscriber",
    title: "Yangi obunachi",
    note: "Ro\u2019yxatga yangi obunachi qo\u2019shilganda",
    on: false,
  },
  {
    id: "works",
    title: "Rejali ishlar",
    note: "Rejalashtirilgan ishlar boshlanishidan bir kun oldin",
    on: true,
  },
];

/** Boshlang'ich holatlar jadvali - reset shu qiymatlarga qaytaradi. */
const DEFAULT_NOTIFICATIONS: Readonly<Record<string, boolean>> = Object.fromEntries(
  // Kortej tipi aniq ko'rsatiladi - aks holda `fromEntries` `any` qaytaradi.
  NOTIFICATIONS.map((item): [string, boolean] => [item.id, item.on]),
);

/**
 * Ikki bosqichli tasdiqning boshlang'ich holati. Alohida const - `useState`
 * va `reset()` bir manbadan oladi (ikki joyda qo'lda yozilsa ajralib qoladi).
 */
const DEFAULT_TWO_FACTOR = true;

interface NormDef {
  key: string;
  label: string;
  value: string;
  unit: string;
  hint: string;
}

const NORMS: readonly NormDef[] = [
  {
    key: "loss",
    label: "Yo\u2019qotish me\u2019yori",
    value: "12",
    unit: "%",
    hint: "Reja bo\u2019yicha ruxsat etilgan yillik yo\u2019qotish ulushi",
  },
  {
    key: "load",
    label: "Yuklama chegarasi",
    value: "85",
    unit: "%",
    hint: "Transformator nominal quvvatiga nisbatan",
  },
  {
    key: "temperature",
    label: "Harorat chegarasi",
    value: "75",
    unit: "\u00b0C",
    hint: "Transformator moyi harorati signal beradigan daraja",
  },
  {
    key: "voltageMin",
    label: "Kuchlanish oralig\u2019i (eng past)",
    value: "209",
    unit: "V",
    hint: "Past kuchlanish tarmog\u2019i uchun quyi chegara",
  },
  {
    key: "voltageMax",
    label: "Kuchlanish oralig\u2019i (eng yuqori)",
    value: "231",
    unit: "V",
    hint: "Past kuchlanish tarmog\u2019i uchun yuqori chegara",
  },
  {
    key: "delay",
    label: "Signal kechikishi",
    value: "5",
    unit: "daqiqa",
    hint: "Chegara buzilishi shuncha davom etsa signal yuboriladi",
  },
];

interface IntegrationDef {
  id: string;
  name: string;
  note: string;
  icon: GlyphIcon;
  /** Ikonka plitkasining foni - aksent tokeni. */
  tile: string;
  status: string;
  tone: BadgeTone;
  action: string;
}

const INTEGRATIONS: readonly IntegrationDef[] = [
  {
    id: "maps",
    name: "Google Maps",
    note: "Xarita sahifasidagi kartografik qatlam va geokodlash",
    icon: MapPin,
    tile: "bg-accent-blue",
    status: "Ulangan",
    tone: "green",
    action: "Sozlash",
  },
  {
    id: "telegram",
    name: "Telegram bot",
    note: "@baliqchi_etk_bot orqali avariya xabarlarini yuborish",
    icon: Send,
    tile: "bg-accent-teal",
    status: "Ulangan",
    tone: "green",
    action: "Sozlash",
  },
  {
    id: "sms",
    name: "SMS shlyuz",
    note: "Obunachilarga o\u2019chirish va to\u2019lov xabarnomalari",
    icon: MessageSquare,
    tile: "bg-accent-amber",
    status: "Sinov rejimi",
    tone: "amber",
    action: "Sozlash",
  },
  {
    id: "erp",
    name: "1C: Buxgalteriya",
    note: "To\u2019lov va hisob-kitob ma\u2019lumotlarini almashish",
    icon: Database,
    tile: "bg-accent-purple",
    status: "Uzilgan",
    tone: "red",
    action: "Ulash",
  },
];

interface SessionDef {
  id: string;
  device: string;
  place: string;
  time: string;
  icon: GlyphIcon;
  /** Joriy seansni yakunlab bo'lmaydi - tugma o'rniga nishon chiqadi. */
  current?: boolean;
}

const SESSIONS: readonly SessionDef[] = [
  {
    id: "desktop",
    device: "Windows 11 \u00b7 Chrome 141",
    place: "192.168.10.24 \u00b7 Baliqchi ETK binosi",
    time: `${TODAY} \u00b7 ${TODAY_TIME}`,
    icon: Monitor,
    current: true,
  },
  {
    id: "phone",
    device: "iPhone 15 \u00b7 Safari",
    place: "94.158.62.11 \u00b7 Andijon",
    time: "9-avgust, 2026 \u00b7 18:20",
    icon: Smartphone,
  },
  {
    id: "laptop",
    device: "Ubuntu 24.04 \u00b7 Firefox",
    place: "10.8.0.6 \u00b7 VPN ulanish",
    time: "7-avgust, 2026 \u00b7 09:05",
    icon: Laptop,
  },
];

/* ---------------------------------------------------------------------------
   Kichik qayta ishlatiladigan bo'laklar
   --------------------------------------------------------------------------- */

/**
 * Ko'rinish uchun maydon - haqiqiy tahrirlash yo'q, shuning uchun `readOnly`.
 * Balandligi 36px (h-9), foni oq kartadan ajralib turishi uchun `bg-canvas`.
 */
function Field({
  label,
  value,
  placeholder,
  type = "text",
  wide,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: "password" | "text";
  wide?: boolean;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", wide && "col-span-2")}>
      <span className="truncate text-[10px] text-ink-soft">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly
        className="h-9 w-full min-w-0 rounded-lg bg-canvas px-3 text-xs font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-soft focus:ring-1 focus:ring-brand/40"
      />
    </label>
  );
}

/** Raqamli me'yor maydoni: o'ng tarafda o'lchov birligi, ostida izoh. */
function NumberField({ label, value, unit, hint }: Omit<NormDef, "key">) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-[10px] text-ink-soft">{label}</span>
      <span className="flex h-9 items-center gap-2 rounded-lg bg-canvas px-3">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          readOnly
          className="w-full min-w-0 bg-transparent text-xs font-medium text-ink outline-none"
        />
        <span className="shrink-0 text-[10px] font-medium text-ink-soft">{unit}</span>
      </span>
      <span className="truncate text-[10px] text-ink-soft">{hint}</span>
    </label>
  );
}

/**
 * Bo'lim ichidagi maydonlar guruhi.
 *
 * Karta juda keng (~1230px), shuning uchun grid `max-w-[880px]` bilan
 * cheklanadi - aks holda ikkita maydon ekran bo'ylab cho'zilib ketardi.
 */
function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5 last:mb-0">
      <h3 className="mb-2 text-[11px] font-semibold text-ink-soft">{title}</h3>
      <div className="grid max-w-[880px] grid-cols-2 gap-x-4 gap-y-3">{children}</div>
    </section>
  );
}

/**
 * Ishlaydigan switch: 36x20 kapsula, ichida 16px doira.
 * Yoqilganda brend ko'k fon; doira 16px o'ngga suriladi (2 + 16 = 18,
 * o'ngda yana 2px bo'shliq qoladi).
 */
function Switch({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        // O'chiq holat `bg-canvas` bo'lsa oq kartada deyarli ko'rinmasdi.
        checked ? "bg-brand" : "bg-[#d4d4d4]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}

/** Izohli qator: chapda nom va tavsif, o'ngda boshqaruv elementi. */
function SettingRow({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-solid border-[#f0f0f0] py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-ink">{title}</p>
        <p className="truncate text-[10px] text-ink-soft">{note}</p>
      </div>
      {children}
    </div>
  );
}

/** Ko'k fonli eslatma bloki. */
function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="flex max-w-[880px] items-start gap-2 rounded-lg bg-tint-blue p-3 text-[11px] leading-tight text-ink-muted">
      <span className="mt-px shrink-0 text-accent-blue">
        <Icon icon={Info} size={14} />
      </span>
      <span>{children}</span>
    </p>
  );
}

/** Bo'lim ichidagi ikkilamchi tugma (kartaning oq foni ustida). */
function GhostButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="flex h-8 shrink-0 items-center rounded-lg bg-canvas px-3 text-xs font-medium text-ink transition-colors hover:bg-black/5"
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------------------
   Bo'limlar mazmuni
   --------------------------------------------------------------------------- */

function ProfileSection() {
  return (
    <>
      {/* Avatar bloki: rasm o'rniga bosh harflar. */}
      <div className="mb-5 flex max-w-[880px] items-center gap-3 rounded-xl bg-canvas p-3">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
          {PROFILE_INITIALS}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{PROFILE_NAME}</p>
          <p className="truncate text-[11px] text-ink-soft">
            Bosh muhandis &middot; Baliqchi ETK
          </p>
        </div>
        <Badge tone="blue">Administrator</Badge>
        <button
          type="button"
          className="flex h-8 shrink-0 items-center rounded-lg bg-surface px-3 text-xs font-medium text-ink transition-colors hover:bg-black/5"
        >
          Rasmni almashtirish
        </button>
      </div>

      <FieldGroup title="Shaxsiy ma&rsquo;lumotlar">
        {PROFILE_FIELDS.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            value={field.value}
            wide={field.wide}
          />
        ))}
      </FieldGroup>
    </>
  );
}

function OrganizationSection() {
  return (
    <FieldGroup title="Korxona rekvizitlari">
      {ORGANIZATION_FIELDS.map((field) => (
        <Field key={field.key} label={field.label} value={field.value} wide={field.wide} />
      ))}
    </FieldGroup>
  );
}

function NotificationsSection({
  state,
  onToggle,
}: {
  state: Readonly<Record<string, boolean>>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="max-w-[880px]">
      {NOTIFICATIONS.map((item) => (
        <SettingRow key={item.id} title={item.title} note={item.note}>
          <Switch
            checked={state[item.id] ?? false}
            onToggle={() => onToggle(item.id)}
            label={item.title}
          />
        </SettingRow>
      ))}
    </div>
  );
}

function NormsSection() {
  return (
    <>
      <FieldGroup title="Texnik me&rsquo;yorlar">
        {NORMS.map((norm) => (
          <NumberField
            key={norm.key}
            label={norm.label}
            value={norm.value}
            unit={norm.unit}
            hint={norm.hint}
          />
        ))}
      </FieldGroup>

      <Hint>
        Me&rsquo;yorlar o&rsquo;zgartirilsa, yangi qiymatlar joriy oy hisobotidan
        boshlab qo&rsquo;llaniladi. Avvalgi davrlar qayta hisoblanmaydi.
      </Hint>
    </>
  );
}

function IntegrationsSection() {
  return (
    <div className="max-w-[880px]">
      {INTEGRATIONS.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 border-b border-solid border-[#f0f0f0] py-3 last:border-b-0"
        >
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg text-white",
              item.tile,
            )}
          >
            <Icon icon={item.icon} size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-ink">{item.name}</p>
            <p className="truncate text-[10px] text-ink-soft">{item.note}</p>
          </div>
          <Badge tone={item.tone}>{item.status}</Badge>
          <GhostButton>{item.action}</GhostButton>
        </div>
      ))}
    </div>
  );
}

function SecuritySection({
  twoFactor,
  onToggleTwoFactor,
}: {
  twoFactor: boolean;
  onToggleTwoFactor: () => void;
}) {
  return (
    <>
      <FieldGroup title="Parolni o&rsquo;zgartirish">
        <Field
          label="Joriy parol"
          value=""
          placeholder="Joriy parolni kiriting"
          type="password"
        />
        <Field
          label="Yangi parol"
          value=""
          placeholder="Kamida 8 ta belgi"
          type="password"
        />
        <Field
          label="Yangi parolni tasdiqlang"
          value=""
          placeholder="Yangi parolni takrorlang"
          type="password"
        />
      </FieldGroup>

      <div className="mb-5 flex max-w-[880px] items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-muted">
          <Icon icon={KeyRound} size={18} />
        </span>
        <p className="min-w-0 flex-1 text-[10px] leading-tight text-ink-soft">
          Parol kamida 8 ta belgidan iborat bo&rsquo;lishi, harf va raqamni o&rsquo;z
          ichiga olishi kerak. Parol har 90 kunda yangilanadi.
        </p>
        <GhostButton>Parolni yangilash</GhostButton>
      </div>

      <section className="mb-5">
        <h3 className="mb-2 text-[11px] font-semibold text-ink-soft">
          Qo&rsquo;shimcha himoya
        </h3>
        <div className="max-w-[880px]">
          <SettingRow
            title="Ikki bosqichli tasdiq"
            note="Kirishda telefonga yuborilgan bir martalik kod so&rsquo;raladi"
          >
            <Switch
              checked={twoFactor}
              onToggle={onToggleTwoFactor}
              label="Ikki bosqichli tasdiq"
            />
          </SettingRow>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold text-ink-soft">Faol seanslar</h3>
        <div className="max-w-[880px]">
          {SESSIONS.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-3 border-b border-solid border-[#f0f0f0] py-3 last:border-b-0"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-muted">
                <Icon icon={session.icon} size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink">{session.device}</p>
                <p className="truncate text-[10px] text-ink-soft">{session.place}</p>
              </div>
              <span className="shrink-0 text-[10px] text-ink-soft">{session.time}</span>
              {session.current ? (
                <Badge tone="green">Joriy seans</Badge>
              ) : (
                <GhostButton>Yakunlash</GhostButton>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/* ---------------------------------------------------------------------------
   Sahifa ko'rinishi
   --------------------------------------------------------------------------- */

/**
 * Sozlamalar sahifasi: chapda bo'limlar navigatsiyasi (200px), o'ngda
 * tanlangan bo'lim mazmuni.
 *
 * Holat faqat ko'rinish uchun - maydonlar `readOnly`, server tomonga hech
 * narsa yuborilmaydi. Ammo bo'lim almashish va switch'lar haqiqiy ishlaydi:
 * "Saqlash" bosilganda yo'lakda tasdiq belgisi chiqadi, biror sozlama
 * o'zgartirilsa yo'qoladi, "Bekor qilish" esa boshlang'ich holatga qaytaradi.
 */
export function SettingsView() {
  const [section, setSection] = useState<SectionId>("profile");
  const [notifications, setNotifications] =
    useState<Readonly<Record<string, boolean>>>(DEFAULT_NOTIFICATIONS);
  const [twoFactor, setTwoFactor] = useState(DEFAULT_TWO_FACTOR);
  const [saved, setSaved] = useState(false);

  const active = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0];

  function toggleNotification(id: string) {
    setNotifications((prev) => ({ ...prev, [id]: !prev[id] }));
    setSaved(false);
  }

  function toggleTwoFactor() {
    setTwoFactor((prev) => !prev);
    setSaved(false);
  }

  /** "Bekor qilish" - barcha o'zgarishlarni boshlang'ich holatga qaytaradi. */
  function reset() {
    setNotifications(DEFAULT_NOTIFICATIONS);
    setTwoFactor(DEFAULT_TWO_FACTOR);
    setSaved(false);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader
        title="Sozlamalar"
        subtitle="Tizim, foydalanuvchi va integratsiya sozlamalari"
      >
        {saved ? (
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-state-ok">
            <Icon icon={Check} size={14} />
            Saqlandi
          </span>
        ) : null}
        <HeaderButton icon={X} tone="muted" onClick={reset}>
          Bekor qilish
        </HeaderButton>
        <HeaderButton icon={Save} tone="brand" onClick={() => setSaved(true)}>
          Saqlash
        </HeaderButton>
      </PageHeader>

      <div className="flex min-h-0 flex-1 gap-2">
        {/* Chap ustun: bo'limlar. Kengligi qat'iy 200px. */}
        <Card className="w-[200px] shrink-0">
          <p className="mb-2 shrink-0 text-[11px] font-semibold text-ink-soft">
            Bo&rsquo;limlar
          </p>
          {/* Past ekranda tugmalar kartadan chiqib ketmasin - ro'yxat skroll
              bo'ladi (`Card` da `overflow-hidden` bor, aks holda kesilardi). */}
          <nav className="flex min-h-0 flex-col gap-1 overflow-y-auto scrollbar-none">
            {SECTIONS.map((item) => {
              const current = item.id === section;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={current ? "page" : undefined}
                  onClick={() => setSection(item.id)}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors",
                    current
                      ? "bg-brand text-white"
                      : "text-ink-muted hover:bg-canvas hover:text-ink",
                  )}
                >
                  <Icon icon={item.icon} size={16} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Pastki blok kartaning oxiriga yopishadi. */}
          <div className="mt-auto shrink-0 border-t border-solid border-[#f0f0f0] pt-3">
            <p className="text-[10px] text-ink-soft">Tizim versiyasi</p>
            <p className="truncate text-xs font-medium text-ink">v1.4.2</p>
            <p className="mt-1 truncate text-[10px] text-ink-soft">Yangilangan: {TODAY}</p>
          </div>
        </Card>

        {/* O'ng ustun: tanlangan bo'lim. Skroll faqat shu karta ichida. */}
        <Card className="min-h-0 flex-1">
          <CardHeader title={active.label}>
            <span className="truncate text-[11px] text-ink-soft">{active.note}</span>
          </CardHeader>

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none pt-3">
            {section === "profile" ? <ProfileSection /> : null}
            {section === "organization" ? <OrganizationSection /> : null}
            {section === "notifications" ? (
              <NotificationsSection state={notifications} onToggle={toggleNotification} />
            ) : null}
            {section === "norms" ? <NormsSection /> : null}
            {section === "integrations" ? <IntegrationsSection /> : null}
            {section === "security" ? (
              <SecuritySection twoFactor={twoFactor} onToggleTwoFactor={toggleTwoFactor} />
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
