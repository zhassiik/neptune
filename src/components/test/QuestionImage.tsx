"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/States";
import { cn } from "@/lib/utils";

/** Сұрақ суреті: пропорция сақталады, lazy loading, басқанда үлкейтіп көру */
export function QuestionImage({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 text-sm text-slate-500">
        <ImageOff className="size-6" /> Суретті жүктеу мүмкін болмады. Бетті жаңартып көріңіз.
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setZoom(1);
          setOpen(true);
        }}
        className="group relative block w-full overflow-hidden rounded-2xl border border-slate-100 bg-white p-2 transition hover:border-brand-200 hover:shadow-soft active:scale-[0.995]"
        aria-label="Суретті үлкейту"
      >
        {!loaded && <Skeleton className="absolute inset-2 rounded-xl" />}
        <Image
          src={src}
          alt={alt}
          width={0}
          height={0}
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 70vw, 860px"
          quality={85}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "mx-auto h-auto max-h-[min(62vh,620px)] w-auto max-w-full rounded-xl object-contain transition-opacity",
            loaded ? "opacity-100" : "min-h-40 opacity-0",
          )}
        />
        <span className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-lg bg-navy-900/70 px-2 py-1 text-xs font-medium text-white opacity-90 transition group-hover:opacity-100">
          <Maximize2 className="size-3.5" /> Үлкейту
        </span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} size="full" title="Сұрақ суреті">
        <div className="mb-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
            disabled={zoom <= 1}
            className="rounded-lg border border-slate-200 p-2 transition hover:bg-slate-50 active:scale-95 disabled:opacity-40"
            aria-label="Кішірейту"
          >
            <ZoomOut className="size-4" />
          </button>
          <span className="w-12 text-center text-sm font-semibold text-slate-600">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.5))}
            disabled={zoom >= 3}
            className="rounded-lg border border-slate-200 p-2 transition hover:bg-slate-50 active:scale-95 disabled:opacity-40"
            aria-label="Үлкейту"
          >
            <ZoomIn className="size-4" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-auto rounded-xl bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element -- түпнұсқа сапада көрсету үшін */}
          <img
            src={src}
            alt={alt}
            style={{ width: `${zoom * 100}%` }}
            className="mx-auto h-auto max-w-none cursor-zoom-in"
            onClick={() => setZoom((z) => (z >= 3 ? 1 : z + 0.5))}
          />
        </div>
      </Modal>
    </>
  );
}
