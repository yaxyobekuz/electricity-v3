import { between, pick } from "./seed";
import { SUBSCRIBERS, subscribersOfTransformer } from "./subscribers";
import { TRANSFORMERS } from "./transformers";

/*
 * Qoidabuzarliklar (dalolatnomalar) reestri. Ro'yxat sahifasi ham, TP detal
 * sahifasidagi "Qoidabuzarliklar" kartasi ham shu yerdan o'qiydi - sonlar
 * ikki joyda bir xil chiqishi uchun.
 */

/** Tekshiruv yakunidagi qaror - yuqoridagi statistika shu bo'yicha yig'iladi. */
export type Verdict = "administrative" | "criminal" | "innocent";

export const VERDICT_LABEL: Record<Verdict, string> = {
  administrative: "Ma\u2019muriy",
  criminal: "Jinoiy",
  innocent: "Aybsiz",
};

/** Dalolatnomaning ko'rib chiqilish bosqichi. */
export type Stage = "closed" | "new" | "review";

export const STAGE_LABEL: Record<Stage, string> = {
  new: "Yangi",
  review: "Tekshiruvda",
  closed: "Yakunlangan",
};

export interface Violation {
  id: string;
  /** Dalolatnoma raqami: "DL-2026/0142". */
  act: string;
  date: string;
  subscriber: string;
  subscriberCode: string;
  tp: string;
  /** TP joylashgan hudud - katak ustiga borilganda ko'rsatiladi. */
  area: string;
  kind: string;
  verdict: Verdict;
  /** Jarima summasi, so'm. Aybsiz deb topilganda 0. */
  fine: number;
  inspector: string;
  stage: Stage;
}

/* ---------------------------------------------------------------------------
   Maket ma'lumotlari - determinlashgan (seed.ts dagi between/pick orqali),
   shuning uchun server va mijoz bir xil markup chizadi.
   --------------------------------------------------------------------------- */

const KINDS = [
  "Hisoblagich pardasi buzilgan",
  "Noqonuniy ulanish",
  "Hisoblagich o\u2019g\u2019irligi",
  "Ko\u2019rsatkich buzib ko\u2019rsatilgan",
  "Muhr shikastlangan",
  "Chetlab o\u2019tuvchi ulanish",
] as const;

/** Dalolatnomani tuzgan nazoratchi (ma'sul xodim). */
const INSPECTORS = [
  "Yo\u2019ldoshev Akmal",
  "Rahimov Shuhrat",
  "Tursunov Bekzod",
  "Ergashev Ulug\u2019bek",
  "Nazarov Oybek",
  "Sobirov Dilshod",
  "Aliyev Jasur",
  "Qodirov Sanjar",
] as const;

/** Maket "bugun"i 10-avgust, 2026 - shuning uchun uch yozgi oy. */
const MONTHS = ["iyun", "iyul", "avgust"] as const;

export const VIOLATIONS: readonly Violation[] = Array.from({ length: 24 }, (_, index) => {
  const seed = index + 701;

  // TP va abonent bir-biriga bog'liq bo'lishi shart: dalolatnoma abonentning
  // o'z transformatorida tuziladi. Qadam 7 - 36 ta TP bilan o'zaro tub son,
  // shuning uchun 24 qatorning hammasi turli TP ga tushadi.
  const transformer = TRANSFORMERS[(index * 7 + 2) % TRANSFORMERS.length];
  // Har bir TP da kamida bitta abonent bor, ammo ma'lumot o'zgarsa ham qator
  // bo'sh qolmasligi uchun umumiy ro'yxatdan zaxira olinadi.
  const candidates = subscribersOfTransformer(transformer.id);
  const subscriber =
    candidates.length > 0
      ? candidates[index % candidates.length]
      : SUBSCRIBERS[index % SUBSCRIBERS.length];

  // Bosqich va qaror qo'lda taqsimlangan - yuqoridagi statistika kartalari
  // barqaror son ko'rsatishi kerak (5 yangi, 10 tekshiruvda, 9 yakunlangan).
  const stage: Stage = index % 5 === 0 ? "new" : index % 5 <= 2 ? "review" : "closed";
  const verdict: Verdict =
    index % 7 === 3 ? "innocent" : index % 4 === 1 ? "criminal" : "administrative";

  const fine =
    verdict === "innocent"
      ? 0
      : verdict === "criminal"
        ? between(seed * 3.7, 5_200_000, 27_400_000, 1_000)
        : between(seed * 3.7, 420_000, 4_600_000, 1_000);

  // Dalolatnoma kelajakda tuzilgan bo'lishi mumkin emas: maketning "bugun"i -
  // `TODAY` (10-avgust, 2026). Shuning uchun avgust kunlari 10 bilan
  // chegaralanadi, iyun va iyul esa to'liq oy.
  const month = MONTHS[index % MONTHS.length];
  const day = between(seed * 11.7, 1, month === "avgust" ? 10 : 28, 1);

  return {
    id: `vl-${String(index + 1).padStart(3, "0")}`,
    act: `DL-2026/${String(between(seed * 5.3, 104, 987, 1)).padStart(4, "0")}`,
    date: `${day}-${month}, 2026`,
    subscriber: subscriber.name,
    subscriberCode: subscriber.code,
    tp: transformer.code,
    area: transformer.area,
    kind: pick(seed * 13.1, KINDS),
    verdict,
    fine,
    inspector: pick(seed * 17.9, INSPECTORS),
    stage,
  };
});

/** Shu TP da tuzilgan dalolatnomalar. */
export function violationsOfTransformer(code: string): Violation[] {
  return VIOLATIONS.filter((item) => item.tp === code);
}
