"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Award, Maximize2, Quote } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

export interface GraduateItem {
  id: string;
  student_name: string;
  score: number | null;
  score_label: string | null;
  text: string;
  photoUrl: string | null;
  certificateUrl: string | null;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function Avatar({ g, size }: { g: GraduateItem; size: number }) {
  return g.photoUrl ? (
    <Image src={g.photoUrl} alt={g.student_name} width={size} height={size} className="size-full object-cover" />
  ) : (
    <span className="grid size-full place-items-center bg-gradient-to-br from-brand-600 to-neptune-500 font-display text-sm font-extrabold text-white">{initials(g.student_name)}</span>
  );
}

/**
 * «Neptune курсының түлектерінің нәтижелері»: фото + пікір + сертификат, түлектер арасында ауысу.
 * Ғарыш (Нептун) стилі: фото — жарқыраған планета фонында, сертификат — оның бұрышында қалқып тұрады.
 */
export function Graduates({ items }: { items: GraduateItem[] }) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  /** Сертификат суретінің пропорциясы (ені/биіктігі): карточка суреттің өз пішініне бейімделеді */
  const [certRatio, setCertRatio] = useState<Record<string, number>>({});
  const g = items[index];
  if (!g) return null;

  const go = (i: number) => {
    setIndex((i + items.length) % items.length);
    setExpanded(false);
  };
  const scoreText = g.score_label || (g.score != null ? `${g.score} балл` : null);
  const paragraphs = g.text.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
  const long = g.text.length > 420;
  const ratio = Math.min(1.8, Math.max(0.6, certRatio[g.id] ?? 4 / 3));
  const landscape = ratio >= 1;

  const arrows = (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => go(index - 1)}
        className="grid size-11 place-items-center rounded-full border border-white/15 bg-white/5 text-white transition hover:border-neptune-400/60 hover:bg-white/10 active:scale-90"
        aria-label="Алдыңғы түлек"
      >
        <ArrowLeft className="size-5" />
      </button>
      <button
        type="button"
        onClick={() => go(index + 1)}
        className="grid size-11 place-items-center rounded-full border border-white/15 bg-white/5 text-white transition hover:border-neptune-400/60 hover:bg-white/10 active:scale-90"
        aria-label="Келесі түлек"
      >
        <ArrowRight className="size-5" />
      </button>
    </div>
  );

  return (
    <section className="space-bg relative isolate overflow-hidden py-16 sm:py-24" aria-labelledby="graduates-title">
      <div className="stars stars-drift" aria-hidden />
      <div className="nebula-drift pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[120%] w-[80%] rounded-full bg-[radial-gradient(closest-side,rgb(47_107_240/0.22),rgb(124_92_255/0.08)_60%,transparent)] blur-2xl" aria-hidden />

      <div className="relative container-page">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="graduates-title" className="text-3xl font-extrabold text-white sm:text-5xl">
            <span className="text-neptune-gradient">Neptune</span> курсының түлектерінің нәтижелері
          </h2>
          <p className="mt-4 text-white/65">Жоғары балл ғана емес — нақты сертификат пен шынайы пікір. Түлектеріміздің жолы</p>
        </div>

        {/* Бір түлек болса — тізім бағаны жоқ, фото мен мәтін екі бағанда */}
        <div
          className={cn(
            "mt-12 grid gap-8 lg:mt-16 lg:items-center lg:gap-10",
            items.length > 1 ? "lg:grid-cols-[88px_minmax(0,1.15fr)_minmax(0,0.85fr)]" : "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]",
          )}
        >
          {/* Түлектер тізімі: телефонда — көлденең, компьютерде — тік */}
          {items.length > 1 && (
            <div className="flex items-center justify-between gap-4 lg:h-full lg:flex-col lg:justify-center">
              <div className="flex gap-3 overflow-x-auto px-1 py-2 lg:max-h-[420px] lg:flex-col lg:overflow-x-visible lg:overflow-y-auto" role="tablist" aria-label="Түлектер">
                {items.map((it, i) => (
                  <button
                    key={it.id}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    onClick={() => go(i)}
                    title={it.student_name}
                    className={cn(
                      "relative size-14 shrink-0 overflow-hidden rounded-full transition sm:size-16",
                      i === index ? "ring-2 ring-neptune-400 ring-offset-4 ring-offset-space-950 shadow-glow" : "opacity-55 hover:opacity-100",
                    )}
                  >
                    <Avatar g={it} size={64} />
                  </button>
                ))}
              </div>
              <div className="shrink-0 lg:mt-4">{arrows}</div>
            </div>
          )}

          {/* Фото мен сертификат — қатар, үлкен; артында Нептун планетасы */}
          <div key={`photo-${g.id}`} className="relative mx-auto w-full max-w-[640px] animate-fade-in lg:max-w-none">
            <div className={cn("relative", g.certificateUrl ? "aspect-[6/5]" : "mx-auto aspect-[4/5] max-w-[480px]")}>
              {/* Нептун планетасы, жарқылы және сақинасы */}
              <div className="absolute top-[8%] left-[2%] aspect-square w-[82%] rounded-full bg-[radial-gradient(circle,rgb(79_220_251/0.32),transparent_68%)] blur-2xl" aria-hidden />
              <div
                className="absolute top-[14%] left-[8%] aspect-square w-[70%] rounded-full bg-[radial-gradient(circle_at_32%_28%,var(--color-neptune-300),var(--color-brand-600)_52%,var(--color-navy-800)_100%)] shadow-[0_0_70px_rgb(79_220_251/0.35)]"
                aria-hidden
              />
              <svg viewBox="0 0 600 500" className="absolute inset-0 size-full" fill="none" aria-hidden>
                <ellipse cx="300" cy="300" rx="296" ry="78" transform="rotate(-12 300 300)" stroke="#4fdcfb" strokeOpacity="0.45" strokeWidth="2" />
              </svg>

              {/* Фото */}
              <div
                className={cn(
                  "absolute top-0 overflow-hidden rounded-[2.5rem] rounded-tl-[5rem] shadow-glow ring-1 ring-white/20",
                  g.certificateUrl ? "left-0 aspect-[4/5] w-[60%]" : "inset-0",
                )}
              >
                {g.photoUrl ? (
                  <Image src={g.photoUrl} alt={g.student_name} fill sizes="(max-width: 1024px) 60vw, 420px" className="object-cover" />
                ) : (
                  <span className="grid size-full place-items-center bg-gradient-to-br from-navy-700 to-brand-700 font-display text-6xl font-extrabold text-white/80">{initials(g.student_name)}</span>
                )}
                <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-space-950/60 to-transparent" aria-hidden />
              </div>

              {/* Сертификат — фотоның қасында, үлкен; басқанда толық ашылады */}
              {g.certificateUrl && (
                <button
                  type="button"
                  onClick={() => setCertOpen(true)}
                  className={cn(
                    "group absolute right-0 rotate-2 rounded-3xl border border-white/25 bg-white p-2 shadow-glow transition hover:rotate-0 hover:scale-[1.03] active:scale-100 sm:p-2.5",
                    landscape ? "bottom-[4%] w-[64%]" : "bottom-0 w-[48%]",
                  )}
                  aria-label={`${g.student_name}: сертификатты үлкейту`}
                >
                  <span className="relative block overflow-hidden rounded-2xl bg-white" style={{ aspectRatio: ratio }}>
                    <Image
                      src={g.certificateUrl}
                      alt={`${g.student_name} — ҰБТ сертификаты`}
                      fill
                      sizes="(max-width: 1024px) 64vw, 440px"
                      className="object-contain"
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        if (img.naturalWidth && img.naturalHeight) setCertRatio((r) => ({ ...r, [g.id]: img.naturalWidth / img.naturalHeight }));
                      }}
                    />
                  </span>
                  <span className="mt-1.5 flex items-center justify-center gap-1.5 text-xs font-bold text-navy-900 sm:text-sm">
                    <Award className="size-4 text-amber-500" /> ҰБТ сертификаты
                    <Maximize2 className="size-3.5 text-slate-400 transition group-hover:text-brand-500" />
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Аты, балы, пікір */}
          <div key={`text-${g.id}`} className="animate-fade-in">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-display text-3xl font-extrabold text-white sm:text-4xl">{g.student_name}</h3>
              {scoreText && <span className="glass-dark rounded-full px-4 py-1.5 font-display text-lg font-extrabold text-neptune-200 shadow-glow">{scoreText}</span>}
            </div>
            <Quote className="mt-6 size-8 text-neptune-400/60" aria-hidden />
            <div className={cn("mt-2 space-y-4 text-[17px] leading-relaxed text-white/80", !expanded && long && "line-clamp-[9]")}>
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              {long && (
                <button type="button" onClick={() => setExpanded((v) => !v)} className="font-semibold text-neptune-300 underline-offset-4 hover:underline">
                  {expanded ? "Жасыру" : "Толығырақ оқу"}
                </button>
              )}
              {g.certificateUrl && (
                <button
                  type="button"
                  onClick={() => setCertOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-neptune-400/60 hover:bg-white/10 active:scale-[0.97]"
                >
                  <Award className="size-4 text-amber-300" /> Сертификатты көру
                </button>
              )}
              {items.length > 1 && <span className="text-sm text-white/40">{index + 1} / {items.length}</span>}
            </div>
          </div>
        </div>
      </div>

      <Modal open={certOpen} onClose={() => setCertOpen(false)} title={`${g.student_name} — сертификат`} size="lg">
        {g.certificateUrl && (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-100">
            <Image src={g.certificateUrl} alt={`${g.student_name} — ҰБТ сертификаты`} fill sizes="(max-width: 768px) 100vw, 768px" className="object-contain" />
          </div>
        )}
      </Modal>
    </section>
  );
}
