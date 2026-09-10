import { SUBSCRIBERS } from "./subscribers";
import { SUBSTATIONS } from "./substations";
import { TRANSFORMERS } from "./transformers";

/*
 * Obyektlararo sonlar SHU YERDA hisoblanadi.
 *
 * Sabab: `substations.ts` -> `transformers.ts` -> `subscribers.ts` zanjiri bir
 * tomonlama (aylanma import bo'lmasligi kerak), shuning uchun podstansiya
 * o'zining nechta transformatori borligini bila olmaydi. Agar bu sonlar har
 * bir modulda alohida "o'ylab topilsa", ekrandagi "65 ta transformator" bilan
 * jadvaldagi 3 ta qator bir-biriga mos kelmay qolardi. Bu modul esa ularni
 * HAQIQIY ro'yxatlardan sanaydi - ya'ni son doim jadval bilan bir xil.
 */

function countBy<T>(items: readonly T[], key: (item: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const id = key(item);
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

const SUBSCRIBERS_BY_TRANSFORMER = countBy(SUBSCRIBERS, (item) => item.transformerId);
const TRANSFORMERS_BY_SUBSTATION = countBy(TRANSFORMERS, (item) => item.substationId);

const SUBSCRIBERS_BY_SUBSTATION = (() => {
  const map = new Map<string, number>();
  for (const transformer of TRANSFORMERS) {
    const count = SUBSCRIBERS_BY_TRANSFORMER.get(transformer.id) ?? 0;
    map.set(transformer.substationId, (map.get(transformer.substationId) ?? 0) + count);
  }
  return map;
})();

/** Transformatorga ulangan iste'molchilar soni. */
export function subscriberCount(transformerId: string): number {
  return SUBSCRIBERS_BY_TRANSFORMER.get(transformerId) ?? 0;
}

/** Podstansiyaga tegishli transformatorlar soni. */
export function transformerCount(substationId: string): number {
  return TRANSFORMERS_BY_SUBSTATION.get(substationId) ?? 0;
}

/** Podstansiya orqali ta'minlanadigan iste'molchilar soni. */
export function substationSubscriberCount(substationId: string): number {
  return SUBSCRIBERS_BY_SUBSTATION.get(substationId) ?? 0;
}

/** Butun tuman bo'yicha yig'ma ko'rsatkichlar - bir nechta sahifada kerak. */
export function districtTotals() {
  return {
    substations: SUBSTATIONS.length,
    transformers: TRANSFORMERS.length,
    subscribers: SUBSCRIBERS.length,
    feeders: SUBSTATIONS.reduce((sum, item) => sum + item.feeders, 0),
  };
}
