import type { Prisma, PrismaClient } from "@/generated/prisma";
import { contractKey, nameKey } from "@/lib/domain/normalize";

import { KEY_SEP } from "./templates";

/*
 * Qoidabuzarlik va murojaatni TP / podstansiyaga bog'lash (malumotlar.md 4.3d).
 * Tekshirish (`validate.ts`) va saqlash (`commit.ts`) AYNAN shu funksiyani
 * ishlatadi - oldindan ko'rishdagi natija saqlangandagi bilan bir xil.
 *
 * Tartib:
 *   1. "Abonent" shartnoma raqami bo'lsa (shu oy abonentlari, bo'lmasa har
 *      qanday oydagi eng so'nggi holati) - abonent va uning TP si. "TP Nomi"
 *      ham boshqa TP ni bir ma'noli ko'rsatsa - "TP Nomi" ustun (ogohlantirish).
 *   2. "TP Nomi" - shu oy TP lari (TP holatlari va abonentlar TP lari) orasida
 *      bitta bo'lsa; shu oyda yo'q bo'lsa - bazadagi barcha TP lar orasida
 *      bitta bo'lsa. "Ma'sul xodim" shu oyda podstansiya ma'sul xodimi bo'lsa,
 *      nomzodlar faqat uning podstansiya(lar)i TP lari (bir xil raqamli TP
 *      boshqa podstansiyalarda ham uchraydi).
 *   3. TP topilmasa - "Ma'sul xodim" shu oyda aynan bitta podstansiyaning
 *      ma'sul xodimi bo'lsa - faqat shu podstansiya.
 *   4. Hech biri - bog'lanmaydi; yozuv baribir saqlanadi.
 * Abonent: shartnoma raqami bo'yicha, aks holda nomi (FISH) shu oyda shu TP
 * abonentlari orasida aynan bitta bo'lsa.
 *
 * Kalitlar tabiiy: TP - "podstansiya|fider|tp" (`nameKey` lar, `KEY_SEP`
 * bilan), podstansiya - `nameKey`, abonent - `contractKey`.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export interface EventLinkIndex {
  /** Shu oy abonentlari: shartnoma kaliti -> TP kaliti. */
  monthContracts: Map<string, string>;
  /** Barcha oylar (eng so'nggi holat): shartnoma kaliti -> TP kaliti. */
  allContracts: Map<string, string>;
  /** Shu oy TP lari: TP nomi kaliti -> TP kalitlari. */
  monthTps: Map<string, string[]>;
  /** Bazadagi barcha TP lar: TP nomi kaliti -> TP kalitlari. */
  allTps: Map<string, string[]>;
  /** Shu oy podstansiya holatlari: xodim kaliti -> podstansiya kalitlari. */
  staffSubstations: Map<string, string[]>;
  /** Shu oy abonentlari: "TP kaliti|FISH kaliti" -> shartnoma kalitlari. */
  subscriberNames: Map<string, string[]>;
}

export interface EventLinkInput {
  transformerName: string | null;
  subscriberName: string | null;
  staffName: string | null;
}

export interface EventLink {
  tpKey: string | null;
  substationKey: string | null;
  contractKey: string | null;
  via: "contract" | "tp" | "staff" | null;
  /** Foydalanuvchiga ogohlantirish (noaniqlik yoki qarama-qarshilik). */
  warning: string | null;
}

export const emptyLinkIndex = (): EventLinkIndex => ({
  monthContracts: new Map(),
  allContracts: new Map(),
  monthTps: new Map(),
  allTps: new Map(),
  staffSubstations: new Map(),
  subscriberNames: new Map(),
});

export const tpKeyOf = (substationKey: string, feederKey: string, tpNameKey: string) =>
  `${substationKey}${KEY_SEP}${feederKey}${KEY_SEP}${tpNameKey}`;

/** "podstansiya / fider / TP" - xabarlar uchun (kalitdan). */
export const tpKeyLabel = (tpKey: string) => tpKey.split(KEY_SEP).join(" / ");

export function pushUnique(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key);
  if (!list) map.set(key, [value]);
  else if (!list.includes(value)) list.push(value);
}

const tpNameOf = (tpKey: string) => tpKey.split(KEY_SEP)[2] ?? "";
export const substationOf = (tpKey: string) => tpKey.split(KEY_SEP)[0] ?? "";

export function resolveEventLink(index: EventLinkIndex, input: EventLinkInput): EventLink {
  const contract = input.subscriberName ? contractKey(input.subscriberName) : "";
  const contractTp = contract ? (index.monthContracts.get(contract) ?? index.allContracts.get(contract) ?? null) : null;
  const staffSubstations = input.staffName ? (index.staffSubstations.get(nameKey(input.staffName)) ?? []) : [];

  let tpByName: string | null = null;
  let ambiguous: string[] = [];
  let outsideStaff = false;
  if (input.transformerName) {
    const name = nameKey(input.transformerName);
    const inMonth = index.monthTps.get(name) ?? [];
    const found = inMonth.length > 0 ? inMonth : (index.allTps.get(name) ?? []);
    // Ma'sul xodim podstansiya(lar)ning xodimi bo'lsa - TP faqat shu podstansiya(lar)dan.
    const candidates =
      staffSubstations.length > 0 ? found.filter((key) => staffSubstations.includes(substationOf(key))) : found;
    outsideStaff = found.length > 0 && candidates.length === 0;
    if (candidates.length === 1) tpByName = candidates[0];
    else if (candidates.length > 1) {
      // Bir nechta TP - abonentning TP si ular orasida bo'lsa, o'shani olamiz.
      if (contractTp && candidates.includes(contractTp)) tpByName = contractTp;
      else ambiguous = candidates;
    }
  }

  let warning: string | null = null;
  let tpKey: string | null = null;
  let via: EventLink["via"] = null;
  if (tpByName && contractTp && tpByName !== contractTp) {
    tpKey = tpByName;
    via = "tp";
    warning = `“TP Nomi” (${tpKeyLabel(tpByName)}) abonentning TP sidan (${tpKeyLabel(contractTp)}) farq qiladi - “TP Nomi” olindi`;
  } else if (contractTp) {
    tpKey = contractTp;
    via = "contract";
  } else if (tpByName) {
    tpKey = tpByName;
    via = "tp";
  } else if (ambiguous.length > 0) {
    warning = `“${input.transformerName}” nomli TP ${ambiguous.length} ta fiderda bor (${ambiguous
      .slice(0, 3)
      .map(tpKeyLabel)
      .join("; ")}) - TP ga bog’lanmadi`;
  } else if (outsideStaff) {
    warning = `“${input.transformerName}” nomli TP ma’sul xodim podstansiyasida (${staffSubstations.join(", ")}) yo’q - TP ga bog’lanmadi`;
  }

  let substationKey = tpKey ? substationOf(tpKey) : null;
  if (!tpKey && staffSubstations.length === 1) {
    substationKey = staffSubstations[0];
    via = "staff";
  }

  // Abonent: shartnoma bo'yicha; aks holda shu TP da nomi bitta bo'lsa.
  let linkedContract: string | null = null;
  if (contract && (index.monthContracts.has(contract) || index.allContracts.has(contract))) {
    linkedContract = contract;
  } else if (tpKey && input.subscriberName) {
    const matches = index.subscriberNames.get(`${tpKey}${KEY_SEP}${nameKey(input.subscriberName)}`) ?? [];
    if (matches.length === 1) linkedContract = matches[0];
    else if (matches.length > 1 && !warning) {
      warning = `“${input.subscriberName}” nomi shu TP da ${matches.length} ta abonentga mos keladi - abonent kartasiga bog’lanmadi`;
    }
  }

  return { tpKey, substationKey, contractKey: linkedContract, via, warning };
}

/* ---------------------------------------------------------------------------
   Bazadan yuklash
   --------------------------------------------------------------------------- */

const TP_KEY_SELECT = {
  nameKey: true,
  feeder: { select: { nameKey: true } },
  substation: { select: { nameKey: true } },
} as const;

type TpKeyRow = { nameKey: string; feeder: { nameKey: string }; substation: { nameKey: string } };
const keyOfTp = (tp: TpKeyRow) => tpKeyOf(tp.substation.nameKey, tp.feeder.nameKey, tp.nameKey);

/** Barcha oylar bo'yicha: shartnomalarning eng so'nggi TP si va barcha TP lar. */
export async function loadGlobalLinks(db: Db, index: EventLinkIndex): Promise<void> {
  const latest = await db.subscriberSnapshot.findMany({
    orderBy: { period: { month: "desc" } },
    distinct: ["subscriberId"],
    select: { subscriber: { select: { contractKey: true } }, transformer: { select: TP_KEY_SELECT } },
  });
  for (const row of latest) index.allContracts.set(row.subscriber.contractKey, keyOfTp(row.transformer));

  const tps = await db.transformer.findMany({ select: TP_KEY_SELECT });
  for (const tp of tps) pushUnique(index.allTps, tp.nameKey, keyOfTp(tp));
}

/** Shu oy bo'yicha (saqlash rejimi - fayllar yozilgandan keyingi baza holati). */
export async function loadMonthLinks(db: Db, periodId: string, index: EventLinkIndex): Promise<void> {
  const tpSnapshots = await db.transformerSnapshot.findMany({
    where: { periodId },
    select: { transformer: { select: TP_KEY_SELECT } },
  });
  for (const row of tpSnapshots) pushUnique(index.monthTps, row.transformer.nameKey, keyOfTp(row.transformer));

  const subscribers = await db.subscriberSnapshot.findMany({
    where: { periodId },
    select: { fullName: true, subscriber: { select: { contractKey: true } }, transformer: { select: TP_KEY_SELECT } },
  });
  for (const row of subscribers) {
    const tpKey = keyOfTp(row.transformer);
    index.monthContracts.set(row.subscriber.contractKey, tpKey);
    pushUnique(index.monthTps, row.transformer.nameKey, tpKey);
    pushUnique(index.subscriberNames, `${tpKey}${KEY_SEP}${nameKey(row.fullName)}`, row.subscriber.contractKey);
  }

  const substations = await db.substationSnapshot.findMany({
    where: { periodId, staffId: { not: null } },
    select: { staff: { select: { nameKey: true } }, substation: { select: { nameKey: true } } },
  });
  for (const row of substations) {
    if (row.staff) pushUnique(index.staffSubstations, row.staff.nameKey, row.substation.nameKey);
  }
}

/** TP kaliti -> id lar (saqlash uchun). */
export async function transformerRefs(
  db: Db,
  tpKeys: Iterable<string>,
): Promise<Map<string, { id: string; feederId: string; substationId: string }>> {
  const wanted = new Set(tpKeys);
  const result = new Map<string, { id: string; feederId: string; substationId: string }>();
  if (wanted.size === 0) return result;
  const names = [...new Set([...wanted].map(tpNameOf))];
  const rows = await db.transformer.findMany({
    where: { nameKey: { in: names } },
    select: { id: true, feederId: true, substationId: true, ...TP_KEY_SELECT },
  });
  for (const row of rows) {
    const key = keyOfTp(row);
    if (wanted.has(key)) result.set(key, { id: row.id, feederId: row.feederId, substationId: row.substationId });
  }
  return result;
}
