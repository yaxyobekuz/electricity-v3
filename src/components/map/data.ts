import {
  CircuitBoard,
  FileText,
  Gauge,
  Hand,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

import type { GlyphIcon } from "@/components/ui/Icon";

import type { MapLocation, MapNodeInfo, MapReportSlice, MapStat, MapTopConsumer } from "./types";

/* ---------------------------------------------------------------------------
   Xarita ierarxiyasining mock ma'lumotlari:
   Podstansiya > Fider > TP > Abonent. Barcha qiymatlar maketdan olingan.
   --------------------------------------------------------------------------- */

/** Maketdagi xarita markazi - Xaqulobod fideri hududi. */
const CENTER = { lat: 40.8735, lng: 71.9792 };

/** Har bir tugun uchun bir xil galereya (public/map/ dagi tayyor rasmlar). */
const GALLERY = [
  "/map/station-1.png",
  "/map/station-2.png",
  "/map/station-3.png",
  "/map/station-4.png",
];

const RESPONSIBLE = "Yaxyobek Xabibulloyev";

function stat(key: string, label: string, value: string, Icon: GlyphIcon): MapStat {
  return { key, label, value, Icon };
}

/** 1234 -> "1,234 mln kWh": maketda kasr ajratgichi - vergul. */
function mlnKwh(thousandKwh: number): string {
  return `${(thousandKwh / 1000).toFixed(3).replace(".", ",")} mln kWh`;
}

/** Yo'qotish har doim hisoblangan va iste'mol ayirmasi (domen.md). */
function energy(calculated: number, consumed: number): MapReportSlice[] {
  return [
    {
      key: "calculated",
      label: "Hisoblangan",
      value: calculated,
      display: mlnKwh(calculated),
      color: "#007cd2",
    },
    {
      key: "consumed",
      label: "Iste’mol",
      value: consumed,
      display: mlnKwh(consumed),
      color: "#22c55e",
    },
    {
      key: "loss",
      label: "Yo’qotish",
      value: calculated - consumed,
      display: mlnKwh(calculated - consumed),
      color: "#ff383c",
    },
  ];
}

function consumers(a: string, b: string, c: string): MapTopConsumer[] {
  return [
    { id: "tp-a303", label: "TP A303", value: a },
    { id: "tp-b86", label: "TP B86", value: b },
    { id: "tp-43", label: "TP 43", value: c },
  ];
}

const TOP_MAIN = consumers("302,1 ming kWh", "150,2 ming kWh", "30,2 ming kWh");
const TOP_TP = consumers("42,4 ming kWh", "21,8 ming kWh", "8,1 ming kWh");
const TOP_SUBSCRIBER = consumers("4,2 ming kWh", "2,1 ming kWh", "0,8 ming kWh");

function info(
  title: string,
  stats: MapStat[],
  calculated: number,
  consumed: number,
  topConsumers: MapTopConsumer[],
): MapNodeInfo {
  return {
    title,
    gallery: GALLERY,
    stats,
    report: energy(calculated, consumed),
    responsible: RESPONSIBLE,
    topConsumers,
  };
}

interface TpSeed {
  id: string;
  label: string;
  lat: number;
  lng: number;
  subscribers: string;
  violations: string;
  power: string;
  meters: string;
  calculated: number;
  consumed: number;
  /** Faqat dastlabki bir necha TP da abonentlar ochib berilgan. */
  people: string[];
}

/**
 * TP koordinatalari markazdan ±0,03 lng / ±0,015 lat oralig'ida tarqatilgan -
 * 14-zoomda markerlar maketdagidek butun xarita bo'ylab yoyiladi.
 */
const TP_SEEDS: TpSeed[] = [
  {
    id: "tp-a303",
    label: "TP A303",
    lat: CENTER.lat - 0.001,
    lng: CENTER.lng + 0.0,
    subscribers: "312 ta",
    violations: "2 ta",
    power: "630 kVA",
    meters: "309 ta",
    calculated: 412,
    consumed: 351,
    people: ["Abonent 10412", "Abonent 10418", "Abonent 10425", "Abonent 10431"],
  },
  {
    id: "tp-a3",
    label: "TP A3",
    lat: CENTER.lat - 0.0105,
    lng: CENTER.lng + 0.0145,
    subscribers: "184 ta",
    violations: "1 ta",
    power: "400 kVA",
    meters: "181 ta",
    calculated: 268,
    consumed: 231,
    people: ["Abonent 20714", "Abonent 20719", "Abonent 20726"],
  },
  {
    id: "tp-01",
    label: "TP 01",
    lat: CENTER.lat - 0.011,
    lng: CENTER.lng - 0.0195,
    subscribers: "126 ta",
    violations: "0 ta",
    power: "250 kVA",
    meters: "126 ta",
    calculated: 154,
    consumed: 138,
    people: ["Abonent 30512", "Abonent 30517", "Abonent 30523"],
  },
  {
    id: "tp-t34",
    label: "TP T34",
    lat: CENTER.lat - 0.0098,
    lng: CENTER.lng + 0.0305,
    subscribers: "241 ta",
    violations: "1 ta",
    power: "400 kVA",
    meters: "238 ta",
    calculated: 322,
    consumed: 279,
    people: ["Abonent 41108", "Abonent 41115", "Abonent 41121", "Abonent 41128"],
  },
  {
    id: "tp-b42",
    label: "TP B42",
    lat: CENTER.lat + 0.0075,
    lng: CENTER.lng - 0.0208,
    subscribers: "97 ta",
    violations: "0 ta",
    power: "250 kVA",
    meters: "97 ta",
    calculated: 131,
    consumed: 119,
    people: [],
  },
  {
    id: "tp-4",
    label: "TP 4",
    lat: CENTER.lat + 0.0132,
    lng: CENTER.lng + 0.0012,
    subscribers: "148 ta",
    violations: "1 ta",
    power: "400 kVA",
    meters: "145 ta",
    calculated: 196,
    consumed: 168,
    people: [],
  },
  {
    id: "tp-a1",
    label: "TP A1",
    lat: CENTER.lat + 0.0103,
    lng: CENTER.lng + 0.0232,
    subscribers: "203 ta",
    violations: "0 ta",
    power: "630 kVA",
    meters: "201 ta",
    calculated: 284,
    consumed: 249,
    people: [],
  },
  {
    id: "tp-788",
    label: "TP 788",
    lat: CENTER.lat + 0.0002,
    lng: CENTER.lng + 0.0124,
    subscribers: "112 ta",
    violations: "1 ta",
    power: "250 kVA",
    meters: "110 ta",
    calculated: 147,
    consumed: 126,
    people: [],
  },
  {
    id: "tp-3312",
    label: "TP 3312",
    lat: CENTER.lat + 0.0068,
    lng: CENTER.lng - 0.0092,
    subscribers: "165 ta",
    violations: "0 ta",
    power: "400 kVA",
    meters: "165 ta",
    calculated: 211,
    consumed: 186,
    people: [],
  },
  {
    id: "tp-512",
    label: "TP 512",
    lat: CENTER.lat - 0.0148,
    lng: CENTER.lng + 0.006,
    subscribers: "89 ta",
    violations: "0 ta",
    power: "160 kVA",
    meters: "89 ta",
    calculated: 108,
    consumed: 98,
    people: [],
  },
];

/** Abonentlar o'z TP si atrofida ~120 m radiusda joylashadi. */
const SUBSCRIBER_OFFSETS = [
  { lat: 0.0011, lng: -0.0013 },
  { lat: -0.0009, lng: 0.0014 },
  { lat: 0.0014, lng: 0.0012 },
  { lat: -0.0013, lng: -0.001 },
];

const SUBSCRIBER_STATS: MapStat[] = [
  stat("meters", "Hisoblagichlar", "1 ta", Gauge),
  stat("violations", "Qoidabuzarliklar", "0 ta", Hand),
  stat("power", "Ajratilgan quvvat", "15 kVt", Zap),
  stat("contracts", "Shartnomalar", "1 ta", FileText),
];

function subscriberNode(seed: TpSeed, label: string, index: number): MapLocation {
  const offset = SUBSCRIBER_OFFSETS[index % SUBSCRIBER_OFFSETS.length];
  return {
    id: `${seed.id}-ab${index + 1}`,
    label,
    level: "subscriber",
    lat: seed.lat + offset.lat,
    lng: seed.lng + offset.lng,
    zoom: 18,
    info: info(label, SUBSCRIBER_STATS, 42, 38, TOP_SUBSCRIBER),
  };
}

const tpNodes: MapLocation[] = TP_SEEDS.map((seed) => ({
  id: seed.id,
  label: seed.label,
  level: "tp",
  lat: seed.lat,
  lng: seed.lng,
  zoom: 16,
  info: info(
    seed.label,
    [
      stat("subscribers", "Abonentlar", seed.subscribers, Users),
      stat("violations", "Qoidabuzarliklar", seed.violations, Hand),
      stat("power", "Quvvati", seed.power, Zap),
      stat("meters", "Hisoblagichlar", seed.meters, Gauge),
    ],
    seed.calculated,
    seed.consumed,
    TOP_TP,
  ),
  children: seed.people.length
    ? seed.people.map((label, index) => subscriberNode(seed, label, index))
    : undefined,
}));

const feederNode: MapLocation = {
  id: "feeder-xaqulobod",
  label: "Xaqulobod fider",
  level: "feeder",
  lat: CENTER.lat,
  lng: CENTER.lng,
  zoom: 14,
  info: info(
    "Xaqulobod fider",
    [
      stat("transformers", "Transformatorlar", "10 ta", CircuitBoard),
      stat("subscribers", "Abonentlar", "1,677 ta", Users),
      stat("violations", "Qoidabuzarliklar", "2 ta", Hand),
      stat("meters", "Hisoblagichlar", "1,661 ta", Gauge),
    ],
    1234,
    1020,
    TOP_MAIN,
  ),
  children: tpNodes,
};

/** Ierarxiya ildizi - podstansiya. */
export const mapRoot: MapLocation = {
  id: "substation-a404",
  label: "Podstansiya A404-SKJ",
  level: "substation",
  lat: CENTER.lat + 0.0056,
  lng: CENTER.lng - 0.0044,
  zoom: 13,
  info: info(
    "A374 - 3B Podstansiyasi",
    [
      stat("feeders", "Fiderlar", "23 ta", Workflow),
      stat("transformers", "Transformatorlar", "3,123 ta", CircuitBoard),
      stat("subscribers", "Abonentlar", "25,133 ta", Users),
      stat("violations", "Qoidabuzarliklar", "5 ta", Hand),
    ],
    1234,
    1020,
    TOP_MAIN,
  ),
  children: [feederNode],
};

/** Maketda ochiq turgan tugun - fider (xaritada uning TP lari ko'rinadi). */
export const defaultNodeId = feederNode.id;

export function findNode(id: string): MapLocation | null {
  const walk = (node: MapLocation): MapLocation | null => {
    if (node.id === id) return node;
    for (const child of node.children ?? []) {
      const hit = walk(child);
      if (hit) return hit;
    }
    return null;
  };
  return walk(mapRoot);
}

export function findParent(id: string): MapLocation | null {
  const walk = (node: MapLocation): MapLocation | null => {
    for (const child of node.children ?? []) {
      if (child.id === id) return node;
      const hit = walk(child);
      if (hit) return hit;
    }
    return null;
  };
  return walk(mapRoot);
}
