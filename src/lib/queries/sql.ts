import "server-only";

/*
 * Xom SQL bo'laklarini yig'ish.
 *
 * Nega `Prisma.sql` / `Prisma.join` / `Prisma.raw` emas: `next dev`
 * (Turbopack) har bir marshrut uchun `@/generated/prisma` modulining alohida
 * nusxasini yuklaydi, Prisma klienti esa `globalThis` da bitta. Bir nusxada
 * yaratilgan `Sql` bo'lagi boshqa nusxadagi klientga `instanceof Sql` dan
 * o'tmaydi va bo'lak o'rniga `$1` parametri sifatida yuboriladi - so'rov
 * "syntax error at or near $1" bilan yiqiladi.
 *
 * Bu yordamchi bo'lakni sinf bilan emas, oddiy maydon belgisi bilan taniydi,
 * natijani esa `$queryRawUnsafe(matn, ...qiymatlar)` ga beradi. Qiymatlar
 * baribir `$1, $2, ...` parametri bo'lib ketadi - SQL ichiga qo'shilmaydi.
 * Matnni faqat `raw()` qo'shadi va unga faqat kod ichidagi o'zgarmas satr
 * beriladi (foydalanuvchi kiritgan qiymat emas).
 */

const BRAND = "__sqlFragment";

export interface SqlFragment {
  readonly [BRAND]: true;
  /** `values.length + 1` ta matn bo'lagi. */
  readonly strings: readonly string[];
  readonly values: readonly unknown[];
}

function isFragment(value: unknown): value is SqlFragment {
  return typeof value === "object" && value !== null && (value as Record<string, unknown>)[BRAND] === true;
}

function fragment(strings: string[], values: unknown[]): SqlFragment {
  return { [BRAND]: true, strings, values };
}

/** Teg: `sql\`t."feederId" = ${id}\``. Ichma-ich bo'laklar yoyiladi. */
export function sql(strings: TemplateStringsArray | readonly string[], ...values: unknown[]): SqlFragment {
  const outStrings: string[] = [strings[0]];
  const outValues: unknown[] = [];

  values.forEach((value, index) => {
    if (isFragment(value)) {
      outStrings[outStrings.length - 1] += value.strings[0];
      value.values.forEach((inner, innerIndex) => {
        outValues.push(inner);
        outStrings.push(value.strings[innerIndex + 1]);
      });
      outStrings[outStrings.length - 1] += strings[index + 1];
    } else {
      outValues.push(value);
      outStrings.push(strings[index + 1]);
    }
  });

  return fragment(outStrings, outValues);
}

/** O'zgarmas SQL matni (ustun nomi, `TRUE` va h.k.). Foydalanuvchi qiymati bermang. */
export function raw(text: string): SqlFragment {
  return fragment([text], []);
}

/** Bo'laklarni ajratuvchi bilan qo'shadi: `join(conditions, " AND ")`. */
export function join(parts: readonly SqlFragment[], separator: string): SqlFragment {
  if (parts.length === 0) return raw("");
  return parts.slice(1).reduce((acc, part) => sql`${acc}${raw(separator)}${part}`, parts[0]);
}

/** `$queryRawUnsafe` ga ega har qanday klient (asosiy yoki tranzaksiya). */
interface RawClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

/** Bo'lakni `$1..$n` parametrlari bilan bajaradi. */
export function queryRows<T>(db: RawClient, query: SqlFragment): Promise<T[]> {
  const text = query.strings.reduce((acc, part, index) => `${acc}$${index}${part}`);
  return db.$queryRawUnsafe<T[]>(text, ...query.values);
}
