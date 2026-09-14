import "server-only";

import type { MeterStatus, Prisma, SubscriberKind } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import { toNumber } from "@/lib/domain/metrics";

import { getFeeder, getSubscriber, getSubstation, getTransformer } from "./entities";
import { listFeeders, listSubscribers, listSubstations, listTransformers } from "./lists";
import { DISTRICT, getScopeSummary, periodUploads, type Db, type EntityRef, type ScopeSummary } from "./scope";

/*
 * Xarita sahifasi (`/map?node=...`) - tanlangan oyda FAQAT bitta tugun va
 * uning bevosita bolalari yuklanadi:
 *
 *   tuman        -> podstansiyalar (markerlar - podstansiyalar)
 *   podstansiya  -> fiderlari (markerlar - podstansiyaning TP lari: fiderda koordinata yo'q)
 *   fider        -> TP lari (markerlar - shu TP lar)
 *   TP           -> abonentlari (markerlar - koordinatasi bor abonentlar, eng ko'pi 500 ta)
 *   abonent      -> o'zi
 *
 * Yig'ma sonlar `getScopeSummary` dan (malumotlar.md 5-bo'lim) - xaritadagi
 * son obyekt sahifasidagi son bilan bir xil. Koordinatalar tekshiriladi:
 * bo'sh yoki diapazondan tashqari nuqta markerga aylanmaydi.
 */

export type MapNodeKind = "substation" | "feeder" | "transformer" | "subscriber";

export type MapNode = { kind: "district" } | { kind: MapNodeKind; id: string };

const NODE_KINDS: readonly MapNodeKind[] = ["substation", "feeder", "transformer", "subscriber"];

/**
 * TP darajasida olinadigan abonentlar chegarasi: sidebar ro'yxati va
 * (alohida) koordinatasi bor abonent markerlari uchun.
 */
export const MAP_SUBSCRIBER_LIMIT = 500;

/** "Eng ko'p" ro'yxatidagi qatorlar soni. */
export const MAP_TOP_LIMIT = 5;

/** `?node=transformer:<id>` -> tugun. Bo'sh yoki noto'g'ri qiymat - tuman. */
export function parseMapNode(value: string | string[] | null | undefined): MapNode {
  const raw = Array.isArray(value) ? value[0] : value;
  const match = /^([a-z]+):(.+)$/.exec(raw ?? "");
  if (!match) return { kind: "district" };
  const kind = match[1] as MapNodeKind;
  if (!NODE_KINDS.includes(kind)) return { kind: "district" };
  return { kind, id: match[2] };
}

/** Tugun -> `/map` havolasi (tuman - parametrsiz). */
export function mapNodeHref(node: MapNode): string {
  if (node.kind === "district") return "/map";
  return `/map?${new URLSearchParams({ node: `${node.kind}:${node.id}` }).toString()}`;
}

export interface MapPoint {
  lat: number;
  lng: number;
}

/**
 * Shablondagi "Lokatsiya (Lat/Long)" -> nuqta. Ikkalasi ham berilgan, son va
 * diapazonda bo'lishi shart; (0, 0) - to'ldirilmagan katak belgisi sifatida
 * tashlab ketiladi.
 */
export function mapPoint(lat: number | null | undefined, lng: number | null | undefined): MapPoint | null {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/** Sidebar qatori va marker manbasi. */
export interface MapChild {
  kind: MapNodeKind;
  id: string;
  name: string;
  point: MapPoint | null;
}

export interface MapChildren {
  kind: MapNodeKind;
  /** Bolalar shabloni shu oyga yuklangan. */
  uploaded: boolean;
  /** Shu oydagi aniq son (`rows` kesilgan bo'lishi mumkin). */
  total: number;
  rows: MapChild[];
}

export interface MapTopItem {
  kind: MapNodeKind;
  id: string;
  name: string;
  value: number;
}

export interface MapTop {
  /** "useful" - Foydali oqim, kWh; "debt" - Qarzdorlik, so'm. */
  metric: "useful" | "debt";
  kind: MapNodeKind;
  /** Manba shabloni shu oyga yuklangan. */
  uploaded: boolean;
  rows: MapTopItem[];
}

/** Abonent darajasi uchun holat qiymatlari. */
export interface MapSubscriberInfo {
  contractNumber: string;
  kind: SubscriberKind;
  meterStatus: MeterStatus;
  debtUzs: number;
  creditUzs: number;
  /** Abonentga bog'langan qoidabuzarliklar; shablon yuklanmagan bo'lsa - null. */
  violations: number | null;
  /** Abonentga bog'langan murojaatlar; shablon yuklanmagan bo'lsa - null. */
  appeals: number | null;
}

export interface MapView {
  node: MapNode;
  /** Obyekt nomi; tuman uchun null (sahifa o'z nomini qo'yadi). */
  name: string | null;
  /** Ota obyektlar, tumandan boshlab (tumanning o'zida - bo'sh). */
  ancestors: { node: MapNode; name: string | null }[];
  /** Tanlangan oyda obyekt holati bor. Tuman uchun doim true. */
  hasSnapshot: boolean;
  /** Obyektning o'z koordinatasi (tuman va fiderda - null). */
  point: MapPoint | null;
  staff: EntityRef | null;
  /** Tuman / podstansiya / fider / TP qamrovi xulosasi; abonentda va holat yo'q bo'lsa - null. */
  summary: ScopeSummary | null;
  subscriber: MapSubscriberInfo | null;
  /** Sidebar ro'yxati; abonentda va holat yo'q bo'lsa - null. */
  children: MapChildren | null;
  /** Xaritadagi bola markerlari. Podstansiyada - TP lar. */
  markers: MapMarkers | null;
  top: MapTop | null;
}

export interface MapMarkers {
  kind: MapNodeKind;
  /** Shu oydagi bolalar soni (koordinatasi yo'qlari bilan). */
  total: number;
  /** Koordinatasi to'g'ri bolalarning aniq soni. */
  located: number;
  /**
   * Koordinatasi to'g'ri bolalar (`point` doim bor). TP darajasida eng ko'pi
   * `MAP_SUBSCRIBER_LIMIT` ta - `located` dan kam bo'lsa ro'yxat kesilgan.
   */
  rows: MapChild[];
}

function child(kind: MapNodeKind, row: { id: string; name: string; lat?: number | null; lng?: number | null }): MapChild {
  return { kind, id: row.id, name: row.name, point: mapPoint(row.lat, row.lng) };
}

/** To'liq yuklangan bolalar ro'yxatidan markerlar: koordinatasi yo'qlari faqat sonda qoladi. */
function markersOf(kind: MapNodeKind, rows: readonly MapChild[]): MapMarkers {
  const located = rows.filter((row) => row.point !== null);
  return { kind, total: rows.length, located: located.length, rows: located };
}

/**
 * `mapPoint` shartining SQL ko'rinishi: ikkala katak to'ldirilgan, diapazonda
 * va (0, 0) emas. Chegara koordinatasi bor abonentlarga qo'yiladi - FISH
 * bo'yicha birinchi 500 ta abonentga emas.
 */
const LOCATED_SUBSCRIBER = {
  latitude: { not: null, gte: -90, lte: 90 },
  longitude: { not: null, gte: -180, lte: 180 },
  NOT: { latitude: 0, longitude: 0 },
} satisfies Prisma.SubscriberSnapshotWhereInput;

function topBy<T extends { id: string; name: string }>(
  kind: MapNodeKind,
  rows: readonly T[],
  value: (row: T) => number,
): MapTopItem[] {
  return [...rows]
    .sort((a, b) => value(b) - value(a) || a.name.localeCompare(b.name, "uz"))
    .slice(0, MAP_TOP_LIMIT)
    .map((row) => ({ kind, id: row.id, name: row.name, value: value(row) }));
}

const DISTRICT_NODE: MapNode = { kind: "district" };
const DISTRICT_ANCESTOR = { node: DISTRICT_NODE, name: null };

async function districtView(periodId: string, db: Db): Promise<MapView> {
  const [summary, substations] = await Promise.all([
    getScopeSummary(periodId, DISTRICT, db),
    listSubstations(periodId, db),
  ]);
  const rows = substations.map((row) => child("substation", row));
  const uploaded = summary.uploads.SUBSTATIONS;
  return {
    node: DISTRICT_NODE,
    name: null,
    ancestors: [],
    hasSnapshot: true,
    point: null,
    staff: null,
    summary,
    subscriber: null,
    children: { kind: "substation", uploaded, total: rows.length, rows },
    markers: markersOf("substation", rows),
    top: {
      metric: "useful",
      kind: "substation",
      uploaded,
      rows: topBy("substation", substations, (row) => row.usefulKwh),
    },
  };
}

async function substationView(periodId: string, id: string, db: Db): Promise<MapView | null> {
  const entity = await getSubstation(id, periodId, db);
  if (!entity) return null;
  const base = {
    node: { kind: "substation", id } as MapNode,
    name: entity.name,
    ancestors: [DISTRICT_ANCESTOR],
    subscriber: null,
  };
  const snapshot = entity.snapshot;
  if (!snapshot) {
    return { ...base, hasSnapshot: false, point: null, staff: null, summary: null, children: null, markers: null, top: null };
  }

  const [summary, feeders, transformers] = await Promise.all([
    getScopeSummary(periodId, { kind: "substation", id }, db),
    listFeeders(periodId, { substationId: id }, db),
    listTransformers(periodId, { substationId: id }, db),
  ]);
  const feederRows = feeders.map((row) => child("feeder", row));
  const transformerRows = transformers.map((row) => child("transformer", row));
  return {
    ...base,
    hasSnapshot: true,
    point: mapPoint(snapshot.lat, snapshot.lng),
    staff: snapshot.staff,
    summary,
    children: { kind: "feeder", uploaded: summary.uploads.FEEDERS, total: feederRows.length, rows: feederRows },
    markers: markersOf("transformer", transformerRows),
    top: {
      metric: "useful",
      kind: "feeder",
      uploaded: summary.uploads.FEEDERS,
      rows: topBy("feeder", feeders, (row) => row.usefulKwh),
    },
  };
}

async function feederView(periodId: string, id: string, db: Db): Promise<MapView | null> {
  const entity = await getFeeder(id, periodId, db);
  if (!entity) return null;
  const base = {
    node: { kind: "feeder", id } as MapNode,
    name: entity.name,
    ancestors: [
      DISTRICT_ANCESTOR,
      { node: { kind: "substation", id: entity.substation.id } as MapNode, name: entity.substation.name },
    ],
    // Fiderlar shablonida koordinata yo'q.
    point: null,
    subscriber: null,
  };
  const snapshot = entity.snapshot;
  if (!snapshot) {
    return { ...base, hasSnapshot: false, staff: null, summary: null, children: null, markers: null, top: null };
  }

  const [summary, transformers] = await Promise.all([
    getScopeSummary(periodId, { kind: "feeder", id }, db),
    listTransformers(periodId, { feederId: id }, db),
  ]);
  const rows = transformers.map((row) => child("transformer", row));
  const uploaded = summary.uploads.TRANSFORMERS;
  return {
    ...base,
    hasSnapshot: true,
    staff: snapshot.staff,
    summary,
    children: { kind: "transformer", uploaded, total: rows.length, rows },
    markers: markersOf("transformer", rows),
    top: {
      metric: "useful",
      kind: "transformer",
      uploaded,
      rows: topBy("transformer", transformers, (row) => row.usefulKwh),
    },
  };
}

async function transformerView(periodId: string, id: string, db: Db): Promise<MapView | null> {
  const entity = await getTransformer(id, periodId, db);
  if (!entity) return null;
  const base = {
    node: { kind: "transformer", id } as MapNode,
    name: entity.name,
    ancestors: [
      DISTRICT_ANCESTOR,
      { node: { kind: "substation", id: entity.substation.id } as MapNode, name: entity.substation.name },
      { node: { kind: "feeder", id: entity.feeder.id } as MapNode, name: entity.feeder.name },
    ],
    subscriber: null,
  };
  const snapshot = entity.snapshot;
  if (!snapshot) {
    return { ...base, hasSnapshot: false, point: null, staff: null, summary: null, children: null, markers: null, top: null };
  }

  const scoped = { periodId, transformerId: id };
  const located = { ...scoped, ...LOCATED_SUBSCRIBER };
  // `listSubscribers` bilan bir xil tartib - FISH bo'yicha.
  const orderBy = [{ fullName: "asc" }, { id: "asc" }] satisfies Prisma.SubscriberSnapshotOrderByWithRelationInput[];
  const [summary, subscribers, total, pinned, locatedCount, debtors] = await Promise.all([
    getScopeSummary(periodId, { kind: "transformer", id }, db),
    // Sidebar ro'yxati - barcha abonentlar (koordinatasi yo'qlari ham).
    db.subscriberSnapshot.findMany({
      where: scoped,
      orderBy,
      take: MAP_SUBSCRIBER_LIMIT,
      // Shaxsiy maydonlar (passport, pinfl) ataylab tanlanmaydi.
      select: { subscriberId: true, fullName: true },
    }),
    db.subscriberSnapshot.count({ where: scoped }),
    // Markerlar - faqat koordinatasi bor abonentlar orasidan chegaralanadi.
    db.subscriberSnapshot.findMany({
      where: located,
      orderBy,
      take: MAP_SUBSCRIBER_LIMIT,
      select: { subscriberId: true, fullName: true, latitude: true, longitude: true },
    }),
    db.subscriberSnapshot.count({ where: located }),
    // Eng katta qarzdorlar - abonentlar reyestri bilan bir xil saralash.
    listSubscribers(
      periodId,
      { scope: { kind: "transformer", id }, debtorsOnly: true, sort: "debt", take: MAP_TOP_LIMIT },
      db,
    ),
  ]);
  const rows = subscribers.map((row) => child("subscriber", { id: row.subscriberId, name: row.fullName }));
  const markerRows = pinned
    .map((row) =>
      child("subscriber", {
        id: row.subscriberId,
        name: row.fullName,
        lat: toNumber(row.latitude),
        lng: toNumber(row.longitude),
      }),
    )
    // SQL sharti `mapPoint` bilan bir xil; bu - ehtiyot uchun.
    .filter((row) => row.point !== null);
  const uploaded = summary.uploads.SUBSCRIBERS;
  return {
    ...base,
    hasSnapshot: true,
    point: mapPoint(snapshot.lat, snapshot.lng),
    staff: snapshot.staff,
    summary,
    children: { kind: "subscriber", uploaded, total, rows },
    markers: { kind: "subscriber", total, located: locatedCount, rows: markerRows },
    top: {
      metric: "debt",
      kind: "subscriber",
      uploaded,
      rows: debtors.rows.map((row) => ({ kind: "subscriber", id: row.id, name: row.fullName, value: row.debtUzs })),
    },
  };
}

async function subscriberView(periodId: string, id: string, db: Db): Promise<MapView | null> {
  const entity = await getSubscriber(id, periodId, db);
  if (!entity) return null;
  const base = {
    node: { kind: "subscriber", id } as MapNode,
    name: entity.fullName,
    // Holat yo'q oyda ota obyektlar abonentning boshqa oydagi holatidan.
    ancestors: [
      DISTRICT_ANCESTOR,
      { node: { kind: "substation", id: entity.substation.id } as MapNode, name: entity.substation.name },
      { node: { kind: "feeder", id: entity.feeder.id } as MapNode, name: entity.feeder.name },
      { node: { kind: "transformer", id: entity.transformer.id } as MapNode, name: entity.transformer.name },
    ],
    summary: null,
    children: null,
    markers: null,
    top: null,
  };
  const snapshot = entity.snapshot;
  if (!snapshot) {
    return { ...base, hasSnapshot: false, point: null, staff: null, subscriber: null };
  }

  const [uploads, violations, appeals] = await Promise.all([
    periodUploads(periodId, db),
    db.violation.count({ where: { periodId, subscriberId: id } }),
    db.appeal.count({ where: { periodId, subscriberId: id } }),
  ]);
  return {
    ...base,
    hasSnapshot: true,
    point: mapPoint(snapshot.lat, snapshot.lng),
    staff: snapshot.staff,
    subscriber: {
      contractNumber: entity.contractNumber,
      kind: snapshot.kind,
      meterStatus: snapshot.meterStatus,
      debtUzs: snapshot.debtUzs,
      creditUzs: snapshot.creditUzs,
      violations: uploads.VIOLATIONS ? violations : null,
      appeals: uploads.APPEALS ? appeals : null,
    },
  };
}

/**
 * Tanlangan oyda tugun ma'lumotlari. Tugun obyekti bazada topilmasa - null
 * (sahifa `notFound()`); obyekt bor, lekin shu oyda holati yo'q -
 * `hasSnapshot: false`.
 */
export function getMapView(periodId: string, node: MapNode, db: Db = prisma): Promise<MapView | null> {
  switch (node.kind) {
    case "district":
      return districtView(periodId, db);
    case "substation":
      return substationView(periodId, node.id, db);
    case "feeder":
      return feederView(periodId, node.id, db);
    case "transformer":
      return transformerView(periodId, node.id, db);
    case "subscriber":
      return subscriberView(periodId, node.id, db);
  }
}

/** Tugun nomi (sarlavha uchun) - obyekt sahifalaridagi keshlangan so'rovlar orqali. */
export async function getMapNodeName(periodId: string, node: MapNode, db: Db = prisma): Promise<string | null> {
  switch (node.kind) {
    case "district":
      return null;
    case "substation":
      return (await getSubstation(node.id, periodId, db))?.name ?? null;
    case "feeder":
      return (await getFeeder(node.id, periodId, db))?.name ?? null;
    case "transformer":
      return (await getTransformer(node.id, periodId, db))?.name ?? null;
    case "subscriber":
      return (await getSubscriber(node.id, periodId, db))?.fullName ?? null;
  }
}
