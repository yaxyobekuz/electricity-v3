import { PageHeader } from "@/components/ui/PageHeader";
import type { CoverageRow, ImportHistoryItem } from "@/lib/import/types";

import { CoverageCard } from "./CoverageCard";
import { DumpRestoreCard } from "./DumpRestoreCard";
import { ImportHistoryCard } from "./ImportHistoryCard";
import { ImportUploader } from "./ImportUploader";
import { TemplateGuideCard } from "./TemplateGuideCard";

/**
 * "Ma’lumot yuklash" sahifasi: yuklash (mijoz), shablonlar, qamrov va tarix.
 *
 * Tekshiruv natijalari uzun bo'lishi mumkin, shuning uchun sahifa tanasi
 * (yo'lakdan pastki qism) o'zi skroll qilinadi.
 */
export function ImportsView({
  coverage,
  history,
}: {
  coverage: CoverageRow[];
  history: ImportHistoryItem[];
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader
        title="Ma’lumot yuklash"
        subtitle="Oylik Excel shablonlarini tekshirish va bazaga saqlash"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto scrollbar-none">
        <div className="grid shrink-0 items-start gap-2 xl:grid-cols-[minmax(0,1fr)_360px]">
          <ImportUploader />
          <TemplateGuideCard />
        </div>
        <div className="shrink-0">
          <CoverageCard rows={coverage} />
        </div>
        <div className="shrink-0">
          <ImportHistoryCard items={history} />
        </div>
        <div className="shrink-0">
          <DumpRestoreCard />
        </div>
      </div>
    </div>
  );
}
