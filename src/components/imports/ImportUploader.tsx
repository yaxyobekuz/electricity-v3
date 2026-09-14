"use client";

import { CircleCheck, CircleX, FileSpreadsheet, FileUp, LoaderCircle, Save, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type DragEvent, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { num } from "@/lib/format";
import { type ImportMode, type ImportResult, MAX_FILE_BYTES, MAX_FILES } from "@/lib/import/types";
import { cn } from "@/lib/ui/cn";

import { ImportFileResult } from "./ImportFileResult";
import { fileSizeLabel } from "./templateFiles";

type Phase = "idle" | ImportMode;

interface Notice {
  tone: "error" | "success";
  text: string;
}

const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

/**
 * Fayl tanlash, "Tekshirish" va "Saqlash".
 *
 * Server holat saqlamaydi: "Saqlash" o'sha fayllarni qayta yuboradi, server
 * qayta tekshirib bitta tranzaksiyada yozadi. Tanlov o'zgarsa, oldingi
 * tekshiruv natijasi eskiradi va "Saqlash" yana o'chadi.
 */
export function ImportUploader() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dragging, setDragging] = useState(false);

  const busy = phase !== "idle";
  const validated = result?.mode === "validate" ? result : null;
  const canCommit = !busy && files.length > 0 && validated !== null && validated.valid;

  function addFiles(list: FileList | readonly File[]) {
    const incoming = Array.from(list);
    const problems: string[] = [];
    const next = [...files];
    for (const file of incoming) {
      if (!file.name.toLowerCase().endsWith(".xlsx")) {
        problems.push(`“${file.name}” - faqat .xlsx fayl qabul qilinadi`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        problems.push(`“${file.name}” - fayl ${fileSizeLabel(MAX_FILE_BYTES)} dan katta`);
        continue;
      }
      // Bir xil nomli fayl qayta tanlansa - almashtiriladi.
      const same = next.findIndex((item) => item.name === file.name);
      if (same >= 0) next[same] = file;
      else next.push(file);
    }
    if (next.length > MAX_FILES) {
      problems.push(`Bir yuklashda ko’pi bilan ${MAX_FILES} ta fayl bo’lishi mumkin`);
      next.length = MAX_FILES;
    }
    if (next.map(fileKey).join("|") !== files.map(fileKey).join("|")) {
      setFiles(next);
      setResult(null);
    }
    setNotice(problems.length > 0 ? { tone: "error", text: problems.join(". ") } : null);
  }

  function removeFile(target: File) {
    setFiles(files.filter((file) => file !== target));
    setResult(null);
    setNotice(null);
  }

  function clearAll() {
    setFiles([]);
    setResult(null);
    setNotice(null);
  }

  async function submit(mode: ImportMode) {
    if (files.length === 0 || busy) return;
    setPhase(mode);
    setNotice(null);
    try {
      const form = new FormData();
      form.set("mode", mode);
      for (const file of files) form.append("files", file, file.name);
      const response = await fetch("/api/imports", { method: "POST", body: form });
      const body = (await response.json().catch(() => null)) as (ImportResult & { message?: string }) | null;

      if (!body || !Array.isArray(body.files)) {
        setResult(null);
        setNotice({
          tone: "error",
          text: body?.message ?? `Server so’rovni bajara olmadi (HTTP ${response.status})`,
        });
        return;
      }

      setResult(body);
      if (mode === "commit") {
        if (body.committed) {
          setFiles([]);
          setNotice({ tone: "success", text: `Ma’lumotlar saqlandi: ${num(body.files.length)} ta fayl` });
          router.refresh();
        } else {
          setNotice({
            tone: "error",
            text: body.message ?? "Saqlash rad etildi: fayllarda xato bor. Bazaga hech narsa yozilmadi",
          });
          // Rad etilgan urinish tarixga yozildi.
          router.refresh();
        }
      } else if (body.message) {
        setNotice({ tone: "error", text: body.message });
      }
    } catch {
      setNotice({ tone: "error", text: "Server bilan aloqa uzildi. Qayta urinib ko’ring" });
    } finally {
      setPhase("idle");
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (!busy) addFiles(event.dataTransfer.files);
  }

  const invalidCount = result ? result.files.filter((file) => file.errorCount > 0).length : 0;

  return (
    <Card className="h-auto!">
      <CardHeader title="Fayllarni yuklash">
        {files.length > 0 && !busy ? (
          <button
            type="button"
            onClick={clearAll}
            className="text-[11px] font-medium text-ink-soft transition-colors hover:text-ink"
          >
            Tanlovni tozalash
          </button>
        ) : null}
      </CardHeader>

      <CardBody className="gap-3">
        <label
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
            dragging ? "border-brand bg-tint-blue" : "border-[#dddddd] bg-canvas hover:border-brand/60",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <input
            type="file"
            multiple
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <span className="flex size-10 items-center justify-center rounded-xl bg-surface text-brand">
            <Icon icon={FileUp} size={22} />
          </span>
          <span className="text-sm font-semibold text-ink">Excel fayllarni shu yerga tashlang yoki tanlang</span>
          <span className="text-[11px] text-ink-soft">
            1–{MAX_FILES} ta .xlsx fayl, har biri {fileSizeLabel(MAX_FILE_BYTES)} gacha. Shablon turi va oy fayl
            ichidan aniqlanadi
          </span>
        </label>

        {files.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {files.map((file) => (
              <li
                key={fileKey(file)}
                className="flex h-10 items-center gap-2 rounded-lg border border-solid border-hairline px-3"
              >
                <span className="shrink-0 text-accent-green">
                  <Icon icon={FileSpreadsheet} size={18} />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink" title={file.name}>
                  {file.name}
                </span>
                <span className="shrink-0 text-[11px] text-ink-soft">{fileSizeLabel(file.size)}</span>
                <button
                  type="button"
                  onClick={() => removeFile(file)}
                  disabled={busy}
                  aria-label={`“${file.name}” faylini olib tashlash`}
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-canvas hover:text-ink disabled:opacity-50"
                >
                  <Icon icon={X} size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => submit("validate")}
            disabled={files.length === 0 || busy}
            className="flex h-9 items-center gap-2 rounded-lg bg-canvas px-4 text-xs font-semibold text-ink transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon
              icon={phase === "validate" ? LoaderCircle : ShieldCheck}
              size={16}
              className={phase === "validate" ? "animate-spin" : undefined}
            />
            {phase === "validate" ? "Tekshirilmoqda..." : "Tekshirish"}
          </button>
          <button
            type="button"
            onClick={() => submit("commit")}
            disabled={!canCommit}
            title={canCommit ? undefined : "Avval fayllarni tekshiring - hammasi xatosiz bo’lishi kerak"}
            className="flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon
              icon={phase === "commit" ? LoaderCircle : Save}
              size={16}
              className={phase === "commit" ? "animate-spin" : undefined}
            />
            {phase === "commit" ? "Saqlanmoqda..." : "Saqlash"}
          </button>
          {busy ? (
            <span className="text-[11px] text-ink-soft">Katta fayllarda bir necha daqiqa davom etishi mumkin</span>
          ) : null}
        </div>

        {notice ? (
          <p
            role={notice.tone === "error" ? "alert" : "status"}
            className={cn(
              "flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
              notice.tone === "error" ? "bg-tint-red text-state-bad" : "bg-tint-green text-state-ok",
            )}
          >
            <span className="mt-px shrink-0">
              <Icon icon={notice.tone === "error" ? CircleX : CircleCheck} size={14} />
            </span>
            {notice.text}
          </p>
        ) : null}

        {result && result.files.length > 0 ? (
          <section className="flex flex-col gap-2">
            {result.mode === "validate" ? (
              <p
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-medium",
                  result.valid ? "bg-tint-green text-state-ok" : "bg-tint-red text-state-bad",
                )}
              >
                {result.valid
                  ? "Barcha fayllar xatosiz - “Saqlash” tugmasi bilan bazaga yozing"
                  : `${num(invalidCount)} ta faylda xato bor. Bitta xato bo’lsa ham butun yuklash rad etiladi - xatolarni tuzatib, qayta tekshiring`}
              </p>
            ) : null}
            {result.files.map((report) => (
              <ImportFileResult
                key={`${report.index}:${report.fileName}`}
                report={report}
                committed={result.committed}
              />
            ))}
          </section>
        ) : null}
      </CardBody>
    </Card>
  );
}
