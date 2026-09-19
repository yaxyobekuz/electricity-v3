"use client";

import { ImageUp, LoaderCircle, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState, useTransition } from "react";

import { Icon } from "@/components/ui/Icon";
import type { SubscriberPhotoKind } from "@/generated/prisma";
import { MAX_PHOTO_BYTES, PHOTO_ACCEPT, PHOTO_KIND_LABEL, photoUrl } from "@/lib/domain/photos";
import { formatDateTime, formatLocalDate } from "@/lib/format";
import { cn } from "@/lib/ui/cn";
import { shrinkImage } from "@/lib/ui/shrink-image";

export interface PhotoSlotPhoto {
  /** Versiyali manzil (`?v=`). */
  url: string;
  /** ISO. */
  updatedAt: string;
}

const TOO_LARGE = `Rasm juda katta (ko’pi bilan ${MAX_PHOTO_BYTES / 1024 / 1024} MB)`;

/**
 * Abonent sahifasidagi rasm joyi: rasm (bosilsa to'liq o'lchamda ochiladi)
 * yoki o'rinbosar, ostida "Yuklash / Almashtirish" va "O'chirish".
 *
 * Tanlangan rasm brauzerda kichraytiriladi (`shrinkImage`) va API ga
 * (`PUT /api/subscribers/<id>/photos/<tur>`) baytlar sifatida yuboriladi;
 * muvaffaqiyatdan keyin sahifa serverdan qayta chiziladi (`router.refresh`).
 * Tur va hajmning yakuniy tekshiruvi - serverda.
 */
export function PhotoSlot({
  subscriberId,
  kind,
  photo,
  placeholder,
  className,
}: {
  subscriberId: string;
  kind: SubscriberPhotoKind;
  photo: PhotoSlotPhoto | null;
  /** Rasm yo'q paytdagi ko'rinish: bosh harflar yoki ikonka. */
  placeholder: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<"upload" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const busy = pending != null || refreshing;
  const label = PHOTO_KIND_LABEL[kind];

  async function request(method: "PUT" | "DELETE", body?: Blob) {
    const response = await fetch(photoUrl(subscriberId, kind), {
      method,
      body,
      headers: body ? { "Content-Type": body.type || "application/octet-stream" } : undefined,
    });
    if (!response.ok) {
      const payload: { message?: string } | null = await response.json().catch(() => null);
      throw new Error(payload?.message ?? `Server xatosi (${response.status})`);
    }
    startRefresh(() => router.refresh());
  }

  async function upload(file: File) {
    setError(null);
    setPending("upload");
    try {
      const body = await shrinkImage(file);
      if (body.size > MAX_PHOTO_BYTES) throw new Error(TOO_LARGE);
      await request("PUT", body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Rasmni yuklab bo’lmadi");
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    if (!window.confirm(`${label} o’chirilsinmi?`)) return;
    setError(null);
    setPending("delete");
    try {
      await request("DELETE");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Rasmni o’chirib bo’lmadi");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-canvas">
        {photo ? (
          <a
            href={photo.url}
            target="_blank"
            rel="noopener"
            title={`${label} - to’liq o’lchamda ochish`}
            className="block size-full"
          >
            <Image src={photo.url} alt={label} fill unoptimized sizes="160px" className="object-cover" />
            <span
              title={`Yuklangan: ${formatDateTime(photo.updatedAt)}`}
              className="absolute inset-x-0 bottom-0 truncate bg-black/45 px-2 py-1 text-[10px] leading-3 text-white"
            >
              {formatLocalDate(photo.updatedAt)}
            </span>
          </a>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 px-2 text-center">
            {placeholder}
            <span className="text-[10px] leading-3 text-ink-soft">Rasm yuklanmagan</span>
          </div>
        )}
        {busy ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-surface/80 text-xs font-medium text-ink-muted">
            <Icon icon={LoaderCircle} size={20} className="animate-spin text-brand" />
            {pending === "delete" ? "O’chirilmoqda…" : "Yuklanmoqda…"}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-full bg-canvas px-2 text-xs font-semibold text-brand transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon icon={ImageUp} size={14} className="shrink-0" />
          <span className="truncate">{photo ? "Almashtirish" : "Yuklash"}</span>
        </button>
        {photo ? (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            title={`${label}ni o’chirish`}
            aria-label={`${label}ni o’chirish`}
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-canvas text-ink-soft transition-colors hover:bg-tint-red hover:text-accent-red disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon icon={Trash2} size={14} />
          </button>
        ) : null}
      </div>

      <input
        ref={input}
        type="file"
        accept={PHOTO_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Bir xil faylni qayta tanlash ham `change` bersin.
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      {error ? (
        <p role="alert" className="shrink-0 text-[10px] leading-3 text-state-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
