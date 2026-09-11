"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { SelectField, type SelectOption } from "@/components/ui/SelectField";
import { SUBSTATIONS } from "@/lib/data/substations";
import { TRANSFORMERS } from "@/lib/data/transformers";

const SUBSTATION_OPTIONS: readonly SelectOption[] = SUBSTATIONS.map((item) => ({
  value: item.id,
  label: item.name,
}));

/**
 * Fiderlar alohida ma'lumot moduli sifatida yo'q, shuning uchun nomlar
 * "Eng ko'p sarfga ega fiderlar" diagrammasidagi bilan bir xil olingan.
 */
const FEEDER_OPTIONS: readonly SelectOption[] = [
  "Xaqulobod",
  "Tovuqxona",
  "Chinobod",
  "Qiyali",
  "Maslahat",
  "Baliqchi",
].map((name) => ({ value: name.toLowerCase(), label: name }));

/**
 * "Filteratsiya" kartasi (Figma `4179:238`, 321.78x197).
 *
 * Ichki o'lchamlar maketdan: sarlavha 18px `h2` (16,16), tana 139px (16,42),
 * uchta 32px qator 8px oraliq bilan (0 / 40 / 80), pastda 19px havola (120).
 * 32 + 8 + 32 + 8 + 32 + 8 + 19 = 139.
 *
 * Maketda faqat yopiq holat chizilgan; ochiluvchi ro'yxat `SelectField` da.
 * Transformatorlar ro'yxati tanlangan podstansiyaga qarab qisqaradi - shuning
 * uchun podstansiya almashtirilganda unga tegishli bo'lmagan transformator
 * tanlovi bekor qilinadi.
 */
export function FilterCard({ className }: { className?: string }) {
  const [substation, setSubstation] = useState<string | null>(null);
  const [feeder, setFeeder] = useState<string | null>(null);
  const [transformer, setTransformer] = useState<string | null>(null);

  const transformerOptions = useMemo<readonly SelectOption[]>(() => {
    const list = substation
      ? TRANSFORMERS.filter((item) => item.substationId === substation)
      : TRANSFORMERS;
    return list.map((item) => ({
      value: item.id,
      label: item.code,
    }));
  }, [substation]);

  function pickSubstation(next: string | null) {
    setSubstation(next);
    // Tanlangan transformator yangi podstansiyaga tegishli bo'lmasa - tozalanadi.
    if (
      transformer &&
      next &&
      !TRANSFORMERS.some((item) => item.id === transformer && item.substationId === next)
    ) {
      setTransformer(null);
    }
  }

  /** Havola eng aniq tanlovga olib boradi. */
  const href = transformer
    ? `/transformers/${transformer}`
    : substation
      ? `/substations/${substation}`
      : "/feeders";

  return (
    <Card className={className}>
      <h2 className="shrink-0 text-sm leading-[18px] font-bold text-ink">Filteratsiya</h2>

      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
        <SelectField
          value={substation}
          options={SUBSTATION_OPTIONS}
          placeholder="Podstansiyani tanlang"
          onChange={pickSubstation}
        />
        <SelectField
          value={feeder}
          options={FEEDER_OPTIONS}
          placeholder="Fiderni tanlang"
          onChange={setFeeder}
        />
        <SelectField
          value={transformer}
          options={transformerOptions}
          placeholder="Transformatorni tanlang"
          onChange={setTransformer}
        />

        {/* Maketda havola tananing pastida, markazda (19px qator). */}
        <div className="mt-auto flex shrink-0 items-center justify-center">
          <Link
            href={href}
            className="text-sm leading-[18px] font-medium text-brand transition-opacity hover:opacity-70"
          >
            Sahifaga o&rsquo;tish
          </Link>
        </div>
      </div>
    </Card>
  );
}
