import type { Scope } from "@/lib/queries/scope";

/*
 * URL'dagi qamrov parametri: `?scope=feeder:<id>`. Ro'yxat sahifalari
 * (abonentlar, qoidabuzarliklar, murojaatlar, ishlar, transformatorlar,
 * fiderlar), hisobot va xarita havolalari shu yagona ko'rinishni ishlatadi -
 * detal sahifasidan "Barchasi" havolasi aynan shu obyekt bilan filtrlangan
 * ro'yxatni ochadi.
 *
 *   (yo'q)                  -> tuman
 *   substation:<id>         -> podstansiya
 *   feeder:<id>             -> fider
 *   transformer:<id>        -> TP
 */

const KINDS = ["substation", "feeder", "transformer"] as const;

/** Noto'g'ri yoki bo'sh qiymat - tuman. */
export function parseScopeParam(value: string | string[] | null | undefined): Scope {
  const raw = Array.isArray(value) ? value[0] : value;
  const match = /^([a-z]+):(.+)$/.exec(raw ?? "");
  if (!match) return { kind: "district" };
  const kind = match[1] as (typeof KINDS)[number];
  if (!KINDS.includes(kind)) return { kind: "district" };
  return { kind, id: match[2] };
}

/** Tuman uchun bo'sh satr, aks holda `"feeder:<id>"`. */
export function scopeParam(scope: Scope): string {
  return scope.kind === "district" ? "" : `${scope.kind}:${scope.id}`;
}

/** `href("/violations", scope)` -> `"/violations?scope=feeder%3A<id>"`. */
export function scopedHref(path: string, scope: Scope, extra?: Record<string, string>): string {
  const params = new URLSearchParams(extra);
  const value = scopeParam(scope);
  if (value) params.set("scope", value);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
