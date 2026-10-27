"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Play, Quote, UserRound } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { parseVideoUrl } from "@/lib/video";
import { VideoPlayer } from "@/components/courses/VideoPlayer";

export interface TestimonialItem {
  id: string;
  student_name: string;
  score: number | null;
  score_label: string | null;
  text: string;
  photoUrl: string | null;
  video_url: string | null;
}

function Avatar({ t, size }: { t: TestimonialItem; size: number }) {
  return t.photoUrl ? (
    <Image src={t.photoUrl} alt={t.student_name} width={size} height={size} className="size-full object-cover" />
  ) : (
    <span className="grid size-full place-items-center bg-brand-50 text-brand-500">
      <UserRound className="size-1/2" />
    </span>
  );
}

/** Оқушылардың пікірлері: жоғарыда аватарлар, төменде таңдалған оқушының карточкасы */
export function Testimonials({ items }: { items: TestimonialItem[] }) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [video, setVideo] = useState(false);
  const t = items[index];
  if (!t) return null;

  const go = (i: number) => {
    setIndex((i + items.length) % items.length);
    setExpanded(false);
  };
  const embeddable = !!parseVideoUrl(t.video_url);
  const scoreText = t.score_label || (t.score != null ? `${t.score} балл` : null);

  return (
    <section className="bg-slate-50/70 py-16 sm:py-24">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Оқушыларымыздың нәтижелері</h2>
          <p className="mt-3 text-slate-500">Нақты оқушылар — нақты балдар. Neptune UBT түлектерінің пікірлері</p>
        </div>

        {/* Аватарлар */}
        <div className="mt-10 flex items-center justify-center gap-3">
          <button type="button" onClick={() => go(index - 1)} className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-navy-900 shadow-soft transition hover:bg-brand-50 active:scale-90" aria-label="Алдыңғы пікір">
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex max-w-full gap-2.5 overflow-x-auto px-1 py-2">
            {items.map((it, i) => (
              <button
                key={it.id}
                type="button"
                onClick={() => go(i)}
                aria-label={it.student_name}
                aria-current={i === index}
                className={cn(
                  "size-14 shrink-0 overflow-hidden rounded-full ring-offset-2 transition sm:size-16",
                  i === index ? "ring-[3px] ring-brand-500" : "opacity-70 ring-1 ring-slate-200 hover:opacity-100",
                )}
              >
                <Avatar t={it} size={64} />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => go(index + 1)} className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-navy-900 shadow-soft transition hover:bg-brand-50 active:scale-90" aria-label="Келесі пікір">
            <ChevronRight className="size-5" />
          </button>
        </div>

        {/* Карточка */}
        <article key={t.id} className="card mx-auto mt-8 grid max-w-5xl animate-fade-in gap-8 overflow-hidden p-5 sm:p-8 md:grid-cols-[320px_1fr] md:items-center">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-[320px] overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-300 via-brand-500 to-navy-800">
            <Avatar t={t} size={400} />
            {scoreText && (
              <span className="absolute top-4 left-4 rounded-full bg-white/95 px-4 py-1.5 font-display text-lg font-extrabold text-brand-600 shadow-soft">{scoreText}</span>
            )}
            {t.video_url && (
              <button
                type="button"
                onClick={() => (embeddable ? setVideo(true) : window.open(t.video_url!, "_blank", "noopener"))}
                className="absolute bottom-4 left-1/2 grid size-16 -translate-x-1/2 place-items-center rounded-full bg-white text-brand-500 shadow-lift transition hover:scale-105 active:scale-95"
                aria-label="Видео-пікірді көру"
              >
                <Play className="ml-1 size-7 fill-current" />
              </button>
            )}
          </div>
          <div>
            <Quote className="size-9 text-brand-200" />
            <h3 className="mt-2 text-2xl font-extrabold sm:text-3xl">{t.student_name}</h3>
            <p className={cn("mt-4 leading-relaxed whitespace-pre-line text-slate-700 sm:text-[17px]", !expanded && "line-clamp-6")}>{t.text}</p>
            {t.text.length > 320 && (
              <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-3 font-semibold text-brand-600 hover:underline">
                {expanded ? "Жасыру" : "Толығырақ оқу"}
              </button>
            )}
          </div>
        </article>
      </div>

      <Modal open={video} onClose={() => setVideo(false)} size="lg" title={t.student_name}>
        <VideoPlayer url={t.video_url} title={t.student_name} />
      </Modal>
    </section>
  );
}
