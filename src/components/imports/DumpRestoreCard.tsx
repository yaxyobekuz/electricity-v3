"use client";

import {
  CircleCheck,
  CircleX,
  DatabaseBackup,
  LoaderCircle,
  TriangleAlert,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { DUMP_ACCEPT, MAX_DUMP_BYTES, type RestoreResult } from "@/lib/db/restore-types";
import { cn } from "@/lib/ui/cn";

import { fileSizeLabel } from "./templateFiles";

/** "idle" - kutilmoqda; "upload" - fayl serverga oqmoqda; "restore" - psql ishlamoqda. */
type Phase = "idle" | "upload" | "restore";

/**
 * Boshqa serverdan olingan to'liq baza nusxasini (`pg_dump`) yuklash.
 *
 * Amal buzuvchi: bazadagi hozirgi ma'lumotlar dump bilan almashtiriladi,
 * shuning uchun tugma alohida tasdiqdan keyin ochiladi. Yuklash foizi XHR
 * orqali ko'rsatiladi - `fetch` yuklash jarayonini bermaydi.
 */
export function DumpRestoreCard() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [percent, setPercent] = useState(0);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = phase !== "idle";

  function choose(next: File | null) {
    setFile(next);
    setResult(null);
    setError(null);
    if (next && next.size > MAX_DUMP_BYTES) {
      setError(`Fayl ${fileSizeLabel(MAX_DUMP_BYTES)} dan katta`);
      setFile(null);
    }
  }

  function send() {
    if (!file || !confirmed || busy) return;
    setResult(null);
    setError(null);
    setPercent(0);
    setPhase("upload");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/restore");
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("X-Dump-Name", encodeURIComponent(file.name));

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) setPercent(Math.round((event.loaded / event.total) * 100));
    };
    // Fayl to'liq ketdi - endi server tiklamoqda (eng uzun bosqich).
    xhr.upload.onload = () => {
      setPercent(100);
      setPhase("restore");
    };
    xhr.onload = () => {
      setPhase("idle");
      let body: RestoreResult | null = null;
      try {
        body = JSON.parse(xhr.responseText) as RestoreResult;
      } catch {
        body = null;
      }
      if (!body || typeof body.ok !== "boolean") {
        setError(`Server so’rovni bajara olmadi (HTTP ${xhr.status})`);
        return;
      }
      setResult(body);
      if (body.ok) {
        setFile(null);
        setConfirmed(false);
        router.refresh();
      }
    };
    xhr.onerror = () => {
      setPhase("idle");
      setError("Server bilan aloqa uzildi. Fayl juda katta bo’lsa, oldinga qo’yilgan server (nginx) chegarasini tekshiring");
    };
    xhr.ontimeout = () => {
      setPhase("idle");
      setError("Kutish vaqti tugadi");
    };
    xhr.send(file);
  }

  return (
    <Card className="h-auto!">
      <CardHeader title="Boshqa serverdan baza nusxasi">
        {file && !busy ? (
          <button
            type="button"
            onClick={() => choose(null)}
            className="text-[11px] font-medium text-ink-soft transition-colors hover:text-ink"
          >
            Tanlovni tozalash
          </button>
        ) : null}
      </CardHeader>

      <CardBody className="gap-3">
        <p className="flex items-start gap-2 rounded-lg bg-tint-red px-3 py-2 text-xs text-state-bad">
          <span className="mt-px shrink-0">
            <Icon icon={TriangleAlert} size={14} />
          </span>
          <span>
            Bu amal <b>butun bazani</b> almashtiradi: hozirgi barcha ma’lumotlar (import tarixi bilan
            birga) o’chiriladi va fayldagi holat o’rnatiladi. Xato bo’lsa hech narsa yozilmaydi.
          </span>
        </p>

        <label
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors",
            "border-[#dddddd] bg-canvas hover:border-brand/60",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <input
            type="file"
            accept={DUMP_ACCEPT}
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              choose(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
          <span className="flex size-10 items-center justify-center rounded-xl bg-surface text-brand">
            <Icon icon={DatabaseBackup} size={22} />
          </span>
          <span className="text-sm font-semibold text-ink">
            pg_dump faylini shu yerga tashlang yoki tanlang
          </span>
          <span className="text-[11px] text-ink-soft">
            <code>pg_dump -Fc</code> arxivi (.dump), oddiy SQL (.sql) yoki ularning .gz siqilgani,{" "}
            {fileSizeLabel(MAX_DUMP_BYTES)} gacha
          </span>
        </label>

        {file ? (
          <div className="flex h-10 items-center gap-2 rounded-lg border border-solid border-hairline px-3">
            <span className="shrink-0 text-brand">
              <Icon icon={DatabaseBackup} size={18} />
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink" title={file.name}>
              {file.name}
            </span>
            <span className="shrink-0 text-[11px] text-ink-soft">{fileSizeLabel(file.size)}</span>
            <button
              type="button"
              onClick={() => choose(null)}
              disabled={busy}
              aria-label="Faylni olib tashlash"
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-canvas hover:text-ink disabled:opacity-50"
            >
              <Icon icon={X} size={14} />
            </button>
          </div>
        ) : null}

        <label className="flex items-start gap-2 text-xs text-ink">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={busy}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 size-3.5 shrink-0 accent-[#dc2626]"
          />
          Bazadagi hozirgi ma’lumotlar o’chirilishiga roziman
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={send}
            disabled={!file || !confirmed || busy}
            className="flex h-9 items-center gap-2 rounded-lg bg-state-bad px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon
              icon={busy ? LoaderCircle : DatabaseBackup}
              size={16}
              className={busy ? "animate-spin" : undefined}
            />
            {phase === "upload"
              ? `Yuklanmoqda... ${percent}%`
              : phase === "restore"
                ? "Tiklanmoqda..."
                : "Bazani tiklash"}
          </button>
          {phase === "restore" ? (
            <span className="text-[11px] text-ink-soft">
              Katta bazada bir necha daqiqa davom etadi - sahifani yopmang
            </span>
          ) : null}
        </div>

        {phase === "upload" ? (
          <div className="h-1 w-full overflow-hidden rounded-full bg-canvas">
            <div className="h-full bg-brand transition-[width]" style={{ width: `${percent}%` }} />
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-tint-red px-3 py-2 text-xs text-state-bad">
            <span className="mt-px shrink-0">
              <Icon icon={CircleX} size={14} />
            </span>
            {error}
          </p>
        ) : null}

        {result ? (
          <div className="flex flex-col gap-2">
            <p
              role={result.ok ? "status" : "alert"}
              className={cn(
                "flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
                result.ok ? "bg-tint-green text-state-ok" : "bg-tint-red text-state-bad",
              )}
            >
              <span className="mt-px shrink-0">
                <Icon icon={result.ok ? CircleCheck : CircleX} size={14} />
              </span>
              <span>
                {result.message}
                {result.format
                  ? ` (${result.format === "custom" ? "pg_dump arxivi" : "SQL fayl"}, ${fileSizeLabel(result.fileSize)}, ${Math.max(1, Math.round(result.durationMs / 1000))} s)`
                  : null}
              </span>
            </p>
            {result.log ? (
              <pre className="max-h-40 overflow-auto rounded-lg bg-canvas p-3 text-[11px] leading-4 whitespace-pre-wrap text-ink-soft">
                {result.log}
              </pre>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
