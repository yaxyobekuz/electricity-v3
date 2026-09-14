import "server-only";

import type { MapChildList, MapIconKey, MapInfo, MapLink, MapPin, MapStat, MapTopList, MapViewProps } from "@/components/map/types";
import { METER_STATUS_LABEL, SUBSCRIBER_KIND_LABEL } from "@/lib/domain/labels";
import { count, energy, money, num, percent } from "@/lib/format";
import { BALIQCHI_DISTRICT } from "@/lib/geo/boundaries";
import type { PeriodInfo } from "@/lib/period";
import { mapNodeHref, type MapChild, type MapNode, type MapNodeKind, type MapView } from "@/lib/queries/map-view";
import type { Scope } from "@/lib/queries/scope";
import { scopedHref } from "@/lib/scope-param";

/*
 * `getMapView` natijasi -> `MapScreen` uchun oddiy matnli props. Barcha son
 * `format.ts` orqali; yuklanmagan shablon - "yuklanmagan" (0 emas).
 */

/** Xarita ildizi - platforma nazorat hududi (chegara bilan bir xil nom). */
const DISTRICT_NAME = BALIQCHI_DISTRICT.name;

const NOT_UPLOADED = "yuklanmagan";

const KIND_LABEL: Record<MapNode["kind"], string> = {
  district: "Tuman",
  substation: "Podstansiya",
  feeder: "Fider",
  transformer: "Transformator",
  subscriber: "Abonent",
};

const PLURAL: Record<MapNodeKind, string> = {
  substation: "Podstansiyalar",
  feeder: "Fiderlar",
  transformer: "Transformatorlar",
  subscriber: "Abonentlar",
};

/** Xarita izohidagi birlik: "Xaritada 38 ta transformator". */
const UNIT: Record<MapNodeKind, string> = {
  substation: "podstansiya",
  feeder: "fider",
  transformer: "transformator",
  subscriber: "abonent",
};

/** Bolalar shabloni yuklanmagan bo'lsa ko'rsatiladigan matn. */
const NOT_UPLOADED_TEXT: Record<MapNodeKind, string> = {
  substation: "Podstansiyalar yuklanmagan",
  feeder: "Fiderlar yuklanmagan",
  transformer: "Transformatorlar yuklanmagan",
  subscriber: "Abonentlar ro’yxati yuklanmagan",
};

const DETAIL_PATH: Record<MapNodeKind, string> = {
  substation: "/substations",
  feeder: "/feeders",
  transformer: "/transformers",
  subscriber: "/subscribers",
};

function nodeName(node: MapNode, name: string | null): string {
  return node.kind === "district" ? DISTRICT_NAME : (name ?? "");
}

function nodeIcon(node: MapNode): MapIconKey {
  return node.kind;
}

function link(node: MapNode, name: string | null): MapLink {
  return {
    key: node.kind === "district" ? "district" : `${node.kind}:${node.id}`,
    label: nodeName(node, name),
    href: mapNodeHref(node),
    icon: nodeIcon(node),
  };
}

function childLink(row: MapChild): MapLink {
  return link({ kind: row.kind, id: row.id }, row.name);
}

/** Qamrov (reyestr havolalari uchun); abonentda - null. */
function scopeOf(node: MapNode): Scope | null {
  if (node.kind === "district") return { kind: "district" };
  if (node.kind === "subscriber") return null;
  return { kind: node.kind, id: node.id };
}

/**
 * Plitkalar tartibi: avval yarim kenglikdagilar, keyin keng plitkalar; yarim
 * plitkalar soni toq bo'lsa oxirgisi keng bo'ladi - to'rda bo'shliq qolmaydi.
 */
function arrange(stats: MapStat[]): MapStat[] {
  const half = stats.filter((stat) => !stat.wide);
  const wide = stats.filter((stat) => stat.wide);
  if (half.length % 2 === 1) half[half.length - 1] = { ...half[half.length - 1], wide: true };
  return [...half, ...wide];
}

function scopeStats(view: MapView, scope: Scope): MapStat[] {
  const summary = view.summary!;
  const subscribers = summary.subscribers;
  /** Qiymat null - shablon yuklanmagan: "yuklanmagan" va havolasiz. */
  const stat = (
    key: string,
    label: string,
    icon: MapIconKey,
    value: number | null,
    path: string | null,
    options: { format?: (value: number) => string; extra?: Record<string, string>; wide?: boolean } = {},
  ): MapStat => ({
    key,
    label,
    icon,
    value: value === null ? NOT_UPLOADED : (options.format ?? count)(value),
    href: value === null || path === null ? null : scopedHref(path, scope, options.extra),
    wide: options.wide,
  });

  const stats: MapStat[] = [];
  if (scope.kind === "district") {
    stats.push(stat("substations", "Podstansiyalar", "substation", summary.counts.substations, "/substations"));
  }
  if (scope.kind === "district" || scope.kind === "substation") {
    stats.push(stat("feeders", "Fiderlar", "feeder", summary.counts.feeders, "/feeders"));
  }
  if (scope.kind !== "transformer") {
    stats.push(stat("transformers", "Transformatorlar", "transformer", summary.counts.transformers, "/transformers"));
  }
  stats.push(
    stat("subscribers", "Abonentlar", "subscriber", subscribers?.total ?? null, "/subscribers"),
    stat("online", "Aloqada", "online", subscribers?.online ?? null, null),
    stat("offline", "Aloqadan chiqqan", "offline", subscribers?.offline ?? null, null),
    stat(
      "violations",
      "Qoidabuzarliklar",
      "violation",
      summary.violations.uploaded ? summary.violations.total : null,
      "/violations",
    ),
    stat("appeals", "Murojaatlar", "appeal", summary.appeals.uploaded ? summary.appeals.total : null, "/appeals"),
    stat(
      "debt",
      "Qarzdorlik",
      "debt",
      summary.subscriberList.uploaded ? summary.subscriberList.debtUzs : null,
      "/subscribers",
      { format: money, extra: { debtors: "1" }, wide: true },
    ),
  );
  return arrange(stats);
}

function subscriberStats(view: MapView): MapStat[] {
  const info = view.subscriber!;
  return arrange([
    { key: "kind", label: "Abonent turi", value: SUBSCRIBER_KIND_LABEL[info.kind], icon: "kind" },
    {
      key: "violations",
      label: "Qoidabuzarliklar",
      value: info.violations === null ? NOT_UPLOADED : count(info.violations),
      icon: "violation",
    },
    {
      key: "appeals",
      label: "Murojaatlar",
      value: info.appeals === null ? NOT_UPLOADED : count(info.appeals),
      icon: "appeal",
    },
    {
      key: "status",
      label: "Holati",
      value: METER_STATUS_LABEL[info.meterStatus],
      icon: info.meterStatus === "ONLINE" ? "online" : "offline",
      wide: true,
    },
    { key: "debt", label: "Qarzdorlik", value: money(info.debtUzs), icon: "debt", wide: true },
    { key: "credit", label: "Haqdorlik", value: money(info.creditUzs), icon: "credit", wide: true },
  ]);
}

function childList(view: MapView, period: PeriodInfo): MapChildList | null {
  const children = view.children;
  if (!children) return null;
  const plural = PLURAL[children.kind];
  const truncated = children.total > children.rows.length;
  return {
    title: plural,
    countLabel: children.uploaded ? count(children.total) : null,
    items: children.rows.map(childLink),
    emptyText: !children.uploaded
      ? NOT_UPLOADED_TEXT[children.kind]
      : children.total === 0
        ? `${period.label} oyida ${plural.toLowerCase()} yo’q`
        : null,
    truncated:
      truncated && view.node.kind === "transformer"
        ? {
            text: `Birinchi ${num(children.rows.length)} tasi ko’rsatilgan`,
            href: scopedHref("/subscribers", scopeOf(view.node)!),
            linkLabel: `Barcha ${num(children.total)} ta abonent`,
          }
        : null,
  };
}

function pins(view: MapView): MapPin[] {
  const result: MapPin[] = [];
  for (const row of view.markers?.rows ?? []) {
    // Fiderda koordinata yo'q - marker bo'lmaydi.
    if (!row.point || row.kind === "feeder") continue;
    result.push({
      id: `${row.kind}:${row.id}`,
      lat: row.point.lat,
      lng: row.point.lng,
      label: row.name,
      kind: row.kind,
      href: mapNodeHref({ kind: row.kind, id: row.id }),
    });
  }
  if (view.point) {
    result.push({
      id: "current",
      lat: view.point.lat,
      lng: view.point.lng,
      label: nodeName(view.node, view.name),
      kind: "current",
      href: null,
    });
  }
  return result;
}

/**
 * Xarita ustidagi izoh: nechta bola markeri chizilgani (podstansiyada - TP lar,
 * sidebar esa fiderlar), kesilgan ro'yxat va koordinatasi yo'q obyektlar.
 */
function mapNote(view: MapView, pinList: MapPin[]): MapViewProps["mapNote"] {
  if (!view.hasSnapshot) return null;
  const markers = view.markers;
  if (!markers) {
    // Abonent shablon qatoridan kelgan - koordinata katagi bo'sh, shablon esa yuklangan.
    return view.node.kind === "subscriber" && !view.point
      ? { text: "Abonent koordinatasi yo’q", missing: true }
      : null;
  }
  if (markers.total === 0) return null;
  const drawn = pinList.filter((pin) => pin.kind !== "current").length;
  const missing = markers.total - markers.located;
  // Kesilgan bo'lsa (TP da 500 dan ortiq koordinatali abonent) - nechtadan chizilgani.
  const truncated = markers.located > markers.rows.length;
  const notes = [
    `Xaritada ${num(drawn)} ta ${UNIT[markers.kind]}` +
      (truncated ? ` (koordinatasi bor ${num(markers.located)} tadan)` : ""),
  ];
  if (missing > 0) notes.push(`${num(missing)} tasining koordinatasi yo’q`);
  return { text: notes.join(" · "), missing: missing > 0 };
}

function topList(view: MapView): MapTopList | null {
  const top = view.top;
  if (!top) return null;
  const debt = top.metric === "debt";
  return {
    title: debt
      ? "Qarzi eng ko’p abonentlar"
      : `Foydali oqimi eng ko’p ${PLURAL[top.kind].toLowerCase()}`,
    items: top.rows.map((row) => ({
      ...link({ kind: row.kind, id: row.id }, row.name),
      value: debt ? money(row.value) : energy(row.value),
    })),
    emptyText: !top.uploaded
      ? NOT_UPLOADED_TEXT[top.kind]
      : top.rows.length === 0
        ? debt
          ? "Qarzdor abonent yo’q"
          : `${PLURAL[top.kind]} yo’q`
        : null,
    tone: debt ? "bad" : "neutral",
  };
}

function info(view: MapView, period: PeriodInfo): MapInfo {
  const node = view.node;
  const title = nodeName(node, view.name);
  const detail =
    node.kind === "district"
      ? { href: "/dashboard", label: "Batafsil" }
      : { href: `${DETAIL_PATH[node.kind]}/${node.id}`, label: "Batafsil" };
  const kindLabel =
    node.kind === "subscriber" && view.subscriber
      ? `${KIND_LABEL.subscriber} · ${view.subscriber.contractNumber}`
      : KIND_LABEL[node.kind];

  const empty: MapInfo = {
    kindLabel,
    title,
    periodLabel: period.label,
    emptyText: null,
    stats: [],
    energy: null,
    energyEmptyText: null,
    staff: null,
    top: null,
    detail,
  };
  if (!view.hasSnapshot) {
    return { ...empty, emptyText: `${title} uchun ${period.label} oyida ma’lumot yo’q` };
  }

  const scope = scopeOf(node);
  const summaryEnergy = view.summary?.energy ?? null;
  return {
    ...empty,
    stats: scope ? scopeStats(view, scope) : subscriberStats(view),
    energy: summaryEnergy
      ? {
          total: energy(summaryEnergy.totalKwh),
          useful: energy(summaryEnergy.usefulKwh),
          loss: energy(summaryEnergy.lossKwh),
          lossPercent: percent(summaryEnergy.lossPercent),
          donut:
            summaryEnergy.usefulKwh >= 0 &&
            summaryEnergy.lossKwh >= 0 &&
            summaryEnergy.usefulKwh + summaryEnergy.lossKwh > 0
              ? { useful: summaryEnergy.usefulKwh, loss: summaryEnergy.lossKwh }
              : null,
        }
      : null,
    // Tumanda energiya - Σ podstansiya holatlari: shablon yuklanmagan bo'lishi mumkin.
    energyEmptyText: scope && !summaryEnergy ? NOT_UPLOADED_TEXT.substation : null,
    staff: view.staff
      ? { name: view.staff.name, href: `/staff?${new URLSearchParams({ q: view.staff.name }).toString()}` }
      : null,
    top: topList(view),
  };
}

export function buildMapViewProps(view: MapView, period: PeriodInfo): MapViewProps {
  const parent = view.ancestors.at(-1);
  const mapPins = pins(view);
  return {
    nodeKey: view.node.kind === "district" ? "district" : `${view.node.kind}:${view.node.id}`,
    current: { label: nodeName(view.node, view.name), icon: nodeIcon(view.node) },
    parent: parent ? link(parent.node, parent.name) : null,
    children: childList(view, period),
    pins: mapPins,
    mapNote: mapNote(view, mapPins),
    info: info(view, period),
  };
}
