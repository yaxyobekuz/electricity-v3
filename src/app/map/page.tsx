import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MapScreen } from "@/components/map/MapScreen";
import { AppShell, SidebarPanel } from "@/components/shell/AppShell";
import { SidebarPeriod } from "@/components/shell/SidebarPeriod";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSelectedPeriod } from "@/lib/period";
import { getMapNodeName, getMapView, parseMapNode } from "@/lib/queries/map-view";

import { buildMapViewProps } from "./view-props";

export async function generateMetadata({ searchParams }: PageProps<"/map">): Promise<Metadata> {
  const node = parseMapNode((await searchParams).node);
  if (node.kind === "district") return { title: "Xarita" };
  const period = await getSelectedPeriod();
  // Davr yo'q bo'lsa ham nom kerak - holatsiz so'rov (bo'sh periodId).
  const name = await getMapNodeName(period?.id ?? "", node);
  return { title: name ? `${name} · Xarita` : "Xarita" };
}

/**
 * Xarita "Boshqaruv paneli" guruhiga kirmaydi - o'zining ikkilamchi paneli
 * bor, shuning uchun `(workspace)` maketidan tashqarida turadi va qobiqni
 * `MapScreen` o'zi chizadi (qidiruv sahifasi bilan bir xil yondashuv).
 *
 * `?node=<substation|feeder|transformer|subscriber>:<id>` - tanlangan oyda
 * faqat shu tugun va uning bevosita bolalari yuklanadi; parametr yo'q yoki
 * noto'g'ri bo'lsa - tuman. Noma'lum `id` - 404.
 */
export default async function MapPage({ searchParams }: PageProps<"/map">) {
  const node = parseMapNode((await searchParams).node);

  const period = await getSelectedPeriod();
  if (!period) {
    return (
      <AppShell
        sidebar={
          <SidebarPanel title="Joylashuvlar">
            <SidebarPeriod />
          </SidebarPanel>
        }
      >
        <EmptyState />
      </AppShell>
    );
  }

  const view = await getMapView(period.id, node);
  if (!view) notFound();

  return <MapScreen view={buildMapViewProps(view, period)} periodSelect={<SidebarPeriod />} />;
}
