"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  Cpu,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Wallet,
  Zap,
} from "lucide-react";

import { AppShell, SidebarPanel } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { DataTable, type TableColumn, type TableRow } from "@/components/ui/DataTable";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/InfoGrid";
import { HeaderButton, PageHeader } from "@/components/ui/PageHeader";
import { dec, energy, money, num, pick, TODAY, TODAY_TIME } from "@/lib/data/seed";
import { SUBSCRIBERS, subscriberTotals } from "@/lib/data/subscribers";
import { TRANSFORMERS, transformerTotals } from "@/lib/data/transformers";
import { cn } from "@/lib/ui/cn";

/* ---------------------------------------------------------------------------
   Tiplar
   --------------------------------------------------------------------------- */

/** AI javobi ichidagi ko'rsatkich qatori (izoh + qiymat + foizli chiziq). */
interface MetricLine {
  key: string;
  label: string;
  value: string;
  /** 0..100 - `ProgressBar` uchun. */
  percent: number;
  /** Chiziq rangi, masalan `bg-accent-blue`. */
  tone: string;
}

/**
 * Javobga biriktiriladigan ma'lumot bloki. Javob shunchaki matn emas:
 * yo'qotish va qarzdorlik savollariga jadval, prognoz hamda anomaliyaga
 * foizli ko'rsatkichlar qaytariladi.
 */
type AnswerBlock =
  | { kind: "metrics"; items: readonly MetricLine[] }
  | { kind: "table"; columns: TableColumn[]; rows: TableRow[] };

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  block?: AnswerBlock;
  /** Blok ostidagi qisqa xulosa. */
  note?: string;
  time: string;
}

interface Conversation {
  id: string;
  title: string;
  date: string;
  messages: readonly ChatMessage[];
}

/* ---------------------------------------------------------------------------
   Javob uchun ma'lumot - hammasi mavjud mock modullaridan hisoblanadi.
   Shu sababli AI javobidagi sonlar ro'yxat sahifalari bilan mos tushadi va
   server bilan mijoz bir xil markup chizadi (determinlashgan).
   --------------------------------------------------------------------------- */

const transformerStats = transformerTotals();
const subscriberStats = subscriberTotals();

/** Yo'qotishi eng yuqori 5 ta TP. */
const TOP_LOSS = [...TRANSFORMERS].sort((a, b) => b.lossPercent - a.lossPercent).slice(0, 5);

/** Balansi eng manfiy 5 ta abonent (manfiy balans - qarzdorlik). */
const TOP_DEBTORS = [...SUBSCRIBERS]
  .filter((item) => item.balance < 0)
  .sort((a, b) => a.balance - b.balance)
  .slice(0, 5);

const LOSS_BLOCK: AnswerBlock = {
  kind: "table",
  columns: [
    { key: "code", label: "TP", grow: 1, align: "left" },
    { key: "area", label: "Hudud", grow: 1.7, align: "left" },
    { key: "loss", label: "Yo’qotish", grow: 1 },
    { key: "load", label: "Yuklama", grow: 1 },
  ],
  rows: [
    ...TOP_LOSS.map((item) => ({
      key: item.id,
      cells: [
        <span key="code" className="truncate font-semibold text-ink">
          {item.code}
        </span>,
        <span key="area" className="truncate text-ink-muted">
          {item.area}
        </span>,
        <span key="loss" className="font-semibold text-trend-up">
          {dec(item.lossPercent)}%
        </span>,
        <span key="load" className="text-ink">
          {num(item.loadPercent)}%
        </span>,
      ],
    })),
    {
      key: "summary",
      cells: [
        <span key="code" className="truncate font-semibold text-ink">
          O&rsquo;rtacha
        </span>,
        <span key="area" className="truncate text-ink-muted">
          {num(transformerStats.total)} ta TP
        </span>,
        <span key="loss" className="font-semibold text-ink">
          {dec(transformerStats.loss)}%
        </span>,
        <span key="load" className="text-ink">
          {dec(transformerStats.load, 0)}%
        </span>,
      ],
    },
  ],
};

const DEBT_BLOCK: AnswerBlock = {
  kind: "table",
  columns: [
    { key: "name", label: "Abonent", grow: 2, align: "left" },
    { key: "tp", label: "TP", grow: 1 },
    { key: "debt", label: "Qarz", grow: 1.4, align: "right" },
  ],
  rows: [
    ...TOP_DEBTORS.map((item) => ({
      key: item.id,
      cells: [
        <span key="name" className="truncate font-medium text-ink">
          {item.name}
        </span>,
        <span key="tp" className="truncate text-ink-muted">
          {item.transformerCode}
        </span>,
        <span key="debt" className="font-semibold text-trend-up">
          {money(Math.abs(item.balance))}
        </span>,
      ],
    })),
    {
      key: "summary",
      cells: [
        <span key="name" className="truncate font-semibold text-ink">
          Jami qarzdorlar
        </span>,
        <span key="tp" className="truncate text-ink-muted">
          {num(subscriberStats.debtor)} ta
        </span>,
        <span key="debt" className="font-semibold text-ink">
          {money(subscriberStats.debt)}
        </span>,
      ],
    },
  ],
};

/** Prognoz - joriy iste'molga mavsumiy 6,4% o'sish qo'llangan. */
const FORECAST_KWH = Math.round(transformerStats.consumption * 1.064);

const FORECAST_BLOCK: AnswerBlock = {
  kind: "metrics",
  items: [
    {
      key: "next",
      label: "Sentabr prognozi",
      value: energy(FORECAST_KWH),
      percent: 88,
      tone: "bg-accent-blue",
    },
    {
      key: "current",
      label: "Avgust fakti",
      value: energy(transformerStats.consumption),
      percent: 83,
      tone: "bg-accent-indigo",
    },
    {
      key: "trust",
      label: "Prognoz ishonchliligi",
      value: "91%",
      percent: 91,
      tone: "bg-accent-green",
    },
    {
      key: "loss",
      label: "Kutilayotgan yo’qotish ulushi",
      value: `${dec(transformerStats.loss)}%`,
      // Chiziq uzunligi - yo'qotishning umumiy energiyadagi haqiqiy ulushi.
      percent: transformerStats.loss,
      tone: "bg-trend-up",
    },
  ],
};

const ANOMALY_BLOCK: AnswerBlock = {
  kind: "metrics",
  items: [
    {
      key: "critical",
      label: "Haddan tashqari yuklangan TP",
      value: `${num(transformerStats.critical)} ta`,
      percent: (transformerStats.critical / transformerStats.total) * 100,
      tone: "bg-accent-red",
    },
    {
      key: "warning",
      label: "Ogohlantirish holatidagi TP",
      value: `${num(transformerStats.warning)} ta`,
      percent: (transformerStats.warning / transformerStats.total) * 100,
      tone: "bg-accent-amber",
    },
    {
      key: "offline",
      label: "Aloqasiz hisoblagichlar",
      value: `${num(subscriberStats.offline)} ta`,
      percent: (subscriberStats.offline / subscriberStats.total) * 100,
      tone: "bg-accent-purple",
    },
  ],
};

const SUMMARY_BLOCK: AnswerBlock = {
  kind: "metrics",
  items: [
    {
      key: "consumption",
      label: "Oylik iste’mol",
      value: energy(transformerStats.consumption),
      percent: 76,
      tone: "bg-accent-blue",
    },
    {
      key: "subscribers",
      label: "Faol abonentlar",
      value: `${num(subscriberStats.active)} ta`,
      percent: (subscriberStats.active / subscriberStats.total) * 100,
      tone: "bg-accent-green",
    },
    {
      key: "load",
      label: "O’rtacha yuklama",
      value: `${dec(transformerStats.load, 0)}%`,
      percent: transformerStats.load,
      tone: "bg-accent-indigo",
    },
  ],
};

/* ---------------------------------------------------------------------------
   Tayyor suhbatlar
   --------------------------------------------------------------------------- */

/** Sidebar ro'yxatiga kirmaydigan "yangi suhbat" oynasi. */
const DRAFT_ID = "draft";

const MAIN_THREAD: readonly ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    text: "Qaysi TP larda yo’qotish darajasi eng yuqori?",
    time: "13:31",
  },
  {
    id: "m2",
    role: "assistant",
    text: `Avgust kesimida ${num(transformerStats.total)} ta TP tahlil qilindi. Yo’qotishi me’yordan (8%) yuqori bo’lgan eng og’ir beshtasi quyida.`,
    block: LOSS_BLOCK,
    note: "Dastlabki uchta TP bo’yicha hisoblagichlarni tekshirish tavsiya etiladi — ular tumandagi umumiy yo’qotishning taxminan uchdan birini beradi.",
    time: "13:31",
  },
  {
    id: "m3",
    role: "user",
    text: "Kelgusi oyga iste’mol prognozi qanday?",
    time: "13:36",
  },
  {
    id: "m4",
    role: "assistant",
    text: `So’nggi 12 oylik qator va mavsumiy o’zgarish asosida sentabr uchun ${energy(FORECAST_KWH)} kutilmoqda — avgustga nisbatan 6,4% ko’p.`,
    block: FORECAST_BLOCK,
    note: "Prognozda havo harorati va o’tgan yilgi sentabr ko’rsatkichlari hisobga olindi.",
    time: "13:37",
  },
  {
    id: "m5",
    role: "user",
    text: "Eng ko’p qarzdor abonentlarni ko’rsat",
    time: "13:40",
  },
  {
    id: "m6",
    role: "assistant",
    text: `Hozirda ${num(subscriberStats.debtor)} ta abonentda qarzdorlik bor, umumiy summa ${money(subscriberStats.debt)}. Eng katta beshtasi:`,
    block: DEBT_BLOCK,
    note: "Yuridik shaxslarda to’lov muddati 10 kundan oshgan — ularga ogohlantirish xati yuborish mumkin.",
    time: "13:41",
  },
];

/** Tarixdagi qisqa suhbatlar uchun yordamchi (savol + qisqa javob). */
function shortThread(prefix: string, question: string, answer: string): ChatMessage[] {
  return [
    { id: `${prefix}-q`, role: "user", text: question, time: "09:12" },
    { id: `${prefix}-a`, role: "assistant", text: answer, time: "09:12" },
  ];
}

const CONVERSATIONS: readonly Conversation[] = [
  {
    id: "c1",
    title: "Yo’qotish tahlili — avgust",
    date: TODAY,
    messages: MAIN_THREAD,
  },
  {
    id: "c2",
    title: "TP-114 yuklama sababi",
    date: "9-avgust, 2026",
    messages: shortThread(
      "c2",
      "TP-114 da yuklama nega oshib ketdi?",
      "TP-114 ga so’nggi ikki oyda 38 ta yangi abonent ulangan, nominal quvvat esa o’zgarmagan. Kunduzgi cho’qqida yuklama 128% ga chiqmoqda — quvvatni oshirish yoki yukning bir qismini TP-119 ga o’tkazish kerak.",
    ),
  },
  {
    id: "c3",
    title: "Iyul hisoboti xulosasi",
    date: "5-avgust, 2026",
    messages: shortThread(
      "c3",
      "Iyul hisobotini qisqacha xulosa qilib ber",
      "Iyulda iste’mol iyunga nisbatan 4,2% oshgan, yo’qotish esa 0,6 punktga kamaygan. Asosiy o’sish maishiy abonentlar hisobiga — issiq kunlar sovutish yukini ko’targan.",
    ),
  },
  {
    id: "c4",
    title: "Hisoblagich aloqasi uzilishi",
    date: "1-avgust, 2026",
    messages: shortThread(
      "c4",
      "Aloqasiz hisoblagichlar qaysi hududda ko’p?",
      `Aloqasiz hisoblagichlarning yarmidan ko’pi tuman markazidan uzoq uchta mahallaga to’g’ri keladi. Jami ${num(subscriberStats.offline)} ta hisoblagich ma’lumot yubormayapti.`,
    ),
  },
  {
    id: "c5",
    title: "Fider F-04 rejimi",
    date: "28-iyul, 2026",
    messages: shortThread(
      "c5",
      "F-04 fiderida kuchlanish tebranishi normalmi?",
      "F-04 bo’yicha kuchlanish kechqurun 6-7% ga pasaymoqda. Bu ruxsat etilgan chegarada, ammo chiziq oxiridagi TP larda zaxira kam — kuzgi rejimda kuzatishni davom ettirish tavsiya etiladi.",
    ),
  },
  {
    id: "c6",
    title: "Qoidabuzarliklar dinamikasi",
    date: "21-iyul, 2026",
    messages: shortThread(
      "c6",
      "Qoidabuzarliklar soni kamaydimi?",
      "Ikkinchi chorakda aniqlangan qoidabuzarliklar birinchi chorakka nisbatan 12% kam. Eng ko’p uchraydigan tur — hisoblagichni chetlab o’tib ulanish.",
    ),
  },
];

/* ---------------------------------------------------------------------------
   Taklif kartalari
   --------------------------------------------------------------------------- */

interface Suggestion {
  key: string;
  label: string;
  icon: GlyphIcon;
  /** Ikonka plitkasining yumshoq foni. */
  tint: string;
  /** Ikonka rangi. */
  accent: string;
}

const SUGGESTIONS: readonly Suggestion[] = [
  {
    key: "loss",
    label: "Qaysi TP larda yo’qotish yuqori?",
    icon: TriangleAlert,
    tint: "bg-tint-red",
    accent: "text-accent-red",
  },
  {
    key: "forecast",
    label: "Kelgusi oyga prognoz",
    icon: TrendingUp,
    tint: "bg-tint-blue",
    accent: "text-accent-blue",
  },
  {
    key: "debt",
    label: "Eng ko’p qarzdor abonentlar",
    icon: Wallet,
    tint: "bg-tint-amber",
    accent: "text-accent-amber",
  },
  {
    key: "anomaly",
    label: "Tarmoqdagi anomaliyalar",
    icon: Zap,
    tint: "bg-tint-purple",
    accent: "text-accent-purple",
  },
];

/** Kalit so'z topilmaganda ishlatiladigan javob boshlanmalari. */
const FALLBACKS = [
  "Savolingiz bo’yicha tarmoq bazasidan quyidagi kesim topildi.",
  "Aniq javob uchun ma’lumot yetarli — joriy holat quyidagicha.",
  "Tarmoqning bugungi holati bo’yicha asosiy raqamlar quyida keltirildi.",
] as const;

/**
 * Savolga tayyor javob tanlaydi. Haqiqiy API chaqiruvi yo'q: kalit so'z
 * bo'yicha oldindan hisoblangan bloklardan biri qaytariladi, mos kelmasa -
 * `pick` orqali determinlashgan umumiy javob.
 */
function buildReply(question: string, seq: number): ChatMessage {
  const q = question.toLowerCase();
  const base = { id: `a${seq}`, role: "assistant" as const, time: TODAY_TIME };

  if (q.includes("qot") || q.includes("isrof")) {
    return {
      ...base,
      text: `Yo’qotish bo’yicha eng og’ir 5 ta TP quyida. Tuman bo’yicha o’rtacha yo’qotish — ${dec(transformerStats.loss)}%.`,
      block: LOSS_BLOCK,
      note: "Ro’yxatdagi TP larda hisoblagichlarni tekshirish birinchi navbatda samara beradi.",
    };
  }

  if (q.includes("prognoz") || q.includes("kelgusi") || q.includes("bashorat")) {
    return {
      ...base,
      text: `Kelgusi oy uchun ${energy(FORECAST_KWH)} iste’mol kutilmoqda — joriy oyga nisbatan 6,4% ko’p.`,
      block: FORECAST_BLOCK,
      note: "Prognoz oxirgi 12 oylik qator va mavsumiy koeffitsiyent asosida hisoblanadi.",
    };
  }

  if (q.includes("qarz") || q.includes("abonent") || q.includes("to’lov")) {
    return {
      ...base,
      text: `Qarzdor abonentlar soni — ${num(subscriberStats.debtor)} ta, umumiy summa ${money(subscriberStats.debt)}.`,
      block: DEBT_BLOCK,
      note: "Qarzdorlikning katta qismi yuridik shaxslarga to’g’ri keladi.",
    };
  }

  if (q.includes("anomal") || q.includes("yuklama") || q.includes("nosozlik")) {
    return {
      ...base,
      text: "Bugungi kesimda tarmoqda uch turdagi chetlanish aniqlandi:",
      block: ANOMALY_BLOCK,
      note: "Kritik yuklamadagi TP lar bo’yicha ish buyurtmasi ochish tavsiya etiladi.",
    };
  }

  return {
    ...base,
    text: pick(seq * 7.3, FALLBACKS),
    block: SUMMARY_BLOCK,
    note: "Savolni aniqroq bering — masalan TP kodi, fider nomi yoki davrni ko’rsating.",
  };
}

/* ---------------------------------------------------------------------------
   Ko'rinish
   --------------------------------------------------------------------------- */

/** Javobga biriktirilgan jadval yoki foizli ko'rsatkichlar. */
function AnswerBlockView({ block }: { block: AnswerBlock }) {
  if (block.kind === "table") {
    return (
      <div className="mt-3">
        <DataTable compact columns={block.columns} rows={block.rows} />
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {block.items.map((item) => (
        <div key={item.key}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[11px] text-ink-muted">{item.label}</span>
            <span className="shrink-0 text-[11px] font-semibold text-ink">{item.value}</span>
          </div>
          <ProgressBar value={item.percent} tone={item.tone} className="mt-1.5" />
        </div>
      ))}
    </div>
  );
}

/** Bitta xabar: foydalanuvchi - o'ngda ko'k kapsula, AI - chapda oq quti. */
function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="max-w-[76%] rounded-2xl bg-brand px-4 py-2.5 text-xs leading-5 text-white">
          {message.text}
        </div>
        <span className="text-[10px] text-ink-soft">{message.time}</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-tint-indigo text-accent-indigo">
        <Icon icon={Sparkles} size={16} />
      </span>
      <div className="min-w-0 max-w-[86%]">
        <div className="rounded-2xl border border-solid border-[#f0f0f0] bg-surface px-4 py-3">
          <p className="text-xs leading-5 text-ink">{message.text}</p>
          {message.block ? <AnswerBlockView block={message.block} /> : null}
          {message.note ? (
            <p className="mt-2.5 text-[11px] leading-4 text-ink-soft">{message.note}</p>
          ) : null}
        </div>
        <span className="mt-1 block text-[10px] text-ink-soft">{message.time}</span>
      </div>
    </div>
  );
}

/** "Javob yozilmoqda" ko'rsatkichi - jo'natilgandan keyin qisqa pauza. */
function TypingBubble() {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-tint-indigo text-accent-indigo">
        <Icon icon={Sparkles} size={16} />
      </span>
      <div
        role="status"
        aria-label="Javob tayyorlanmoqda"
        className="flex h-9 items-center gap-1 rounded-2xl border border-solid border-[#f0f0f0] bg-surface px-4"
      >
        {[0, 140, 280].map((delay) => (
          <span
            key={delay}
            style={{ animationDelay: `${delay}ms` }}
            className="size-1.5 animate-bounce rounded-full bg-ink-soft"
          />
        ))}
      </div>
    </div>
  );
}

/** Suhbat bo'sh bo'lganda: 4 ta tayyor savol kartasi. */
function EmptyState({ onPick }: { onPick: (question: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-tint-indigo text-accent-indigo">
        <Icon icon={Sparkles} size={24} />
      </span>
      <div className="text-center">
        <h2 className="text-base font-bold text-ink">Nimadan boshlaymiz?</h2>
        <p className="mt-1 text-xs text-ink-soft">
          Tayyor savollardan birini tanlang yoki o&rsquo;z savolingizni yozing.
        </p>
      </div>
      <div className="grid w-full max-w-[560px] grid-cols-2 gap-2">
        {SUGGESTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onPick(item.label)}
            className="flex items-center gap-3 rounded-xl bg-canvas p-3 text-left transition-colors hover:bg-black/5"
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                item.tint,
                item.accent,
              )}
            >
              <Icon icon={item.icon} size={16} />
            </span>
            <span className="min-w-0 text-xs font-medium text-ink">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Sun'iy intellekt sahifasi: chapda suhbatlar tarixi, o'ngda chat.
 *
 * Bu bo'lim `(workspace)` guruhiga kirmaydi, shuning uchun `WorkspaceSidebar`
 * o'rniga o'z panelini ko'rsatadi va `AppShell` ni o'zi chizadi (xarita
 * sahifasidagi kabi).
 */
export function AiScreen() {
  const [activeId, setActiveId] = useState<string>(CONVERSATIONS[0].id);
  // Har bir suhbat o'z xabarlarini saqlaydi - tarixga qaytilganda yozishmalar
  // yo'qolmaydi.
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>(() => {
    const initial: Record<string, ChatMessage[]> = { [DRAFT_ID]: [] };
    for (const item of CONVERSATIONS) initial[item.id] = [...item.messages];
    return initial;
  });
  const [draft, setDraft] = useState("");
  // Javob kutilayotgan suhbat id'si (yo'q bo'lsa - `null`). Oddiy `boolean`
  // yetmaydi: kutish paytida boshqa suhbatga o'tilsa, "yozilmoqda" ko'rsatkichi
  // begona suhbatda ko'rinib qolardi.
  const [pendingId, setPendingId] = useState<string | null>(null);

  const messages = threads[activeId] ?? [];
  const waiting = pendingId === activeId;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  // Yangi xabar id'si uchun hisoblagich - `Date.now()` ishlatilmaydi.
  const counterRef = useRef(0);

  // Yangi xabar qo'shilganda ro'yxat pastiga suriladi.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, waiting, activeId]);

  // Komponent yopilsa, "javob yozilmoqda" taymeri bekor qilinadi.
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  function ask(question: string) {
    const text = question.trim();
    // Bir vaqtda bitta javob tayyorlanadi - shu sababli tekshiruv umumiy.
    if (!text || pendingId !== null) return;

    counterRef.current += 1;
    const seq = counterRef.current;
    // Javob kelguncha boshqa suhbatga o'tilsa ham xabar o'z joyiga tushsin.
    const target = activeId;

    setThreads((prev) => ({
      ...prev,
      [target]: [
        ...(prev[target] ?? []),
        { id: `u${seq}`, role: "user", text, time: TODAY_TIME },
      ],
    }));
    setDraft("");
    setPendingId(target);

    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setThreads((prev) => ({
        ...prev,
        [target]: [...(prev[target] ?? []), buildReply(text, seq)],
      }));
      setPendingId(null);
      timerRef.current = null;
    }, 550);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(draft);
  }

  // Enter - jo'natish, Shift+Enter - yangi qator.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      ask(draft);
    }
  }

  function startNewChat() {
    setThreads((prev) => ({ ...prev, [DRAFT_ID]: [] }));
    setActiveId(DRAFT_ID);
    setDraft("");
  }

  function clearActiveChat() {
    // Kutilayotgan javob ham bekor qilinadi, aks holda tozalangan suhbatga
    // 550 ms dan keyin javob qaytib tushardi.
    if (pendingId === activeId) {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      setPendingId(null);
    }
    setThreads((prev) => ({ ...prev, [activeId]: [] }));
  }

  return (
    <AppShell
      sidebar={
        <SidebarPanel
          title="Sun’iy intellekt"
          footer={
            <div className="flex shrink-0 items-center gap-2.5 rounded-xl bg-canvas px-3 py-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-tint-indigo text-accent-indigo">
                <Icon icon={Cpu} size={16} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-ink">
                  Model: Baliqchi-GPT
                </p>
                <p className="truncate text-[10px] text-ink-soft">
                  Javoblar tuman tarmog&rsquo;i ma&rsquo;lumotlari asosida
                </p>
              </div>
            </div>
          }
        >
          <button
            type="button"
            onClick={startNewChat}
            className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Icon icon={Plus} size={18} />
            Yangi suhbat
          </button>

          <p className="mt-2 shrink-0 text-[11px] font-semibold text-ink-soft">
            Suhbatlar tarixi
          </p>

          <nav aria-label="Suhbatlar tarixi">
            <ul className="flex flex-col gap-1">
              {CONVERSATIONS.map((item) => {
                const active = item.id === activeId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(item.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-canvas",
                        active && "bg-canvas",
                      )}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-tint-blue text-accent-blue">
                        <Icon icon={MessageSquare} size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-ink">
                          {item.title}
                        </span>
                        <span className="block truncate text-[10px] text-ink-soft">
                          {item.date}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </SidebarPanel>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-2">
        <PageHeader
          title="Tahlil yordamchisi"
          subtitle="Tarmoq ma’lumotlari bo’yicha savol bering"
        >
          <HeaderButton icon={Trash2} onClick={clearActiveChat}>
            Suhbatni tozalash
          </HeaderButton>
        </PageHeader>

        <Card className="min-h-0 flex-1">
          {/* Faqat shu blok skroll qilinadi, sahifaning o'zi emas. */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
            {messages.length === 0 && !waiting ? (
              <EmptyState onPick={ask} />
            ) : (
              <div className="flex flex-col gap-4 pr-1 pb-1">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {waiting ? <TypingBubble /> : null}
              </div>
            )}
          </div>

          {/* Kiritish maydoni - kartaning pastidagi qat'iy qator. */}
          <form
            onSubmit={handleSubmit}
            className="flex shrink-0 items-end gap-2 border-t border-solid border-[#f0f0f0] pt-3"
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Savolingizni yozing"
              placeholder="Masalan: TP-066 bo’yicha oxirgi oy yo’qotishi qancha?"
              /* Fon `bg-canvas`: karta oq bo'lgani uchun maydon shu tarzda
                 ajralib turadi (qidiruv maydoni bilan bir xil uslub). */
              className="h-[52px] min-h-[52px] flex-1 resize-none rounded-xl bg-canvas px-3.5 py-4 text-xs leading-5 text-ink outline-none scrollbar-none placeholder:text-ink-soft focus:ring-1 focus:ring-brand/40"
            />
            <button
              type="submit"
              disabled={pendingId !== null || draft.trim().length === 0}
              aria-label="Jo’natish"
              className="flex size-[52px] shrink-0 items-center justify-center rounded-xl bg-brand text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Icon icon={Send} size={18} />
            </button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
