import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TransformersView } from "@/components/transformers/TransformersView";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSelectedPeriod } from "@/lib/period";
import { getTransformerRegistry } from "@/lib/queries/transformers-registry";
import { parseScopeParam } from "@/lib/scope-param";

export const metadata: Metadata = { title: "Transformatorlar" };

/**
 * "Transformatorlar" reestri. Tanlangan oyning TP holatlari; qamrov
 * (`?scope=substation|feeder|transformer:<id>`) serverda qo'llanadi,
 * qidiruv (`?q=`) - boshlang'ich qiymat, filtrlash mijozda.
 *
 * Qamrov obyekti bazada topilmasa - 404.
 */
export default async function Page(props: PageProps<"/transformers">) {
  const period = await getSelectedPeriod();
  if (!period) return <EmptyState />;

  const searchParams = await props.searchParams;
  const registry = await getTransformerRegistry(period.id, parseScopeParam(searchParams.scope));
  if (!registry) notFound();

  const q = Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q;

  return <TransformersView period={period} registry={registry} initialQuery={q ?? ""} />;
}
