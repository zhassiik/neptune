import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, BadgeCheck, CheckCircle2, GraduationCap } from "lucide-react";
import type { PlatformSettings } from "@/lib/types";

const primaryCta =
  "inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-neptune-500 px-7 text-base font-semibold text-white shadow-glow transition hover:brightness-110 active:scale-[0.97]";
const secondaryCta =
  "inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-7 text-base font-semibold text-white transition hover:border-neptune-400/60 hover:bg-white/10 active:scale-[0.97]";

/** Апай туралы негізгі блок: ғарыш фоны, фото — «Нептун планетасы», орбита, көрсеткіштер */
export function Hero({ settings, cta }: { settings: PlatformSettings; cta: { href: string; external: boolean } }) {
  const bio = settings.teacher_bio.split("\n").map((l) => l.replace(/^[-•\s]+/, "").trim()).filter(Boolean);
  const [main, ...rest] = settings.landing_stats;

  return (
    <section className="space-bg relative isolate overflow-hidden">
      <div className="stars" aria-hidden />
      <div className="relative container-page grid items-center gap-12 py-12 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:py-20">
        {/* Мәтін */}
        <div className="animate-fade-in">
          <span className="glass-dark inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium text-neptune-200">
            <span className="size-2 rounded-full bg-neptune-400 shadow-[0_0_10px_var(--color-neptune-400)]" /> ҰБТ математика · Neptune UBT
          </span>
          <h1 className="mt-5 text-4xl leading-[1.08] font-extrabold text-white sm:text-5xl lg:text-[3.6rem]">
            ҰБТ математикасын <span className="text-neptune-gradient">сеніммен</span> тапсыр
          </h1>

          <div className="glass-dark mt-7 rounded-3xl p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <GraduationCap className="size-6 text-neptune-300" />
              <span className="font-display text-xl font-extrabold text-white sm:text-2xl">{settings.teacher_name}</span>
            </div>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {bio.map((line) => (
                <li key={line} className="flex items-start gap-2 text-[15px] text-white/80">
                  <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-neptune-400" /> {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {cta.external ? (
              <a href={cta.href} target="_blank" rel="noopener noreferrer" className={primaryCta}>
                Курсқа қосылу <ArrowRight className="size-5" />
              </a>
            ) : (
              <Link href={cta.href} className={primaryCta}>
                Курсқа қосылу <ArrowRight className="size-5" />
              </Link>
            )}
            <Link href="/courses" className={secondaryCta}>
              Курстарды көру
            </Link>
          </div>
        </div>

        {/* Фото + орбита */}
        <div className="relative order-first mx-auto w-full max-w-[340px] animate-fade-in sm:max-w-[440px] lg:order-none lg:max-w-[520px]">
          <div className="relative aspect-square">
            {/* Планета жарқылы */}
            <div className="absolute inset-[4%] rounded-full bg-[radial-gradient(circle,rgb(79_220_251/0.35),transparent_65%)] blur-2xl" aria-hidden />
            {/* Айналатын орбита */}
            <div className="absolute inset-0 animate-orbit" aria-hidden>
              <svg viewBox="0 0 520 520" className="size-full" fill="none">
                <circle cx="260" cy="260" r="252" stroke="url(#orbitGrad)" strokeWidth="1.5" strokeDasharray="2 9" strokeLinecap="round" />
                <circle cx="438" cy="82" r="7" fill="#4fdcfb" />
                <circle cx="438" cy="82" r="14" fill="#4fdcfb" opacity="0.25" />
                <circle cx="30" cy="330" r="4.5" fill="#a78bfa" />
                <defs>
                  <linearGradient id="orbitGrad" x1="0" y1="0" x2="520" y2="520" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#85eaff" />
                    <stop offset="1" stopColor="#5590ff" stopOpacity="0.4" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            {/* Сақина (Нептунның сақиналары) */}
            <svg viewBox="0 0 520 520" className="absolute inset-0 size-full" fill="none" aria-hidden>
              <ellipse cx="260" cy="275" rx="250" ry="70" transform="rotate(-16 260 275)" stroke="#4fdcfb" strokeOpacity="0.35" strokeWidth="2" />
            </svg>

            <div className="absolute inset-[11%] overflow-hidden rounded-full bg-gradient-to-br from-navy-700 via-brand-700 to-neptune-500 shadow-glow ring-4 ring-neptune-400/40">
              <Image
                src="/brand/teacher.webp"
                alt={settings.teacher_name}
                fill
                priority
                sizes="(max-width: 1024px) 85vw, 470px"
                className="object-cover"
              />
            </div>

            <div className="glass-dark absolute top-[6%] left-0 flex items-center gap-2.5 rounded-2xl bg-space-950/60 px-4 py-3 sm:left-[-4%]">
              <span className="grid size-9 place-items-center rounded-xl bg-neptune-400/15 text-neptune-300">
                <Award className="size-5" />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-bold text-white">ҰБТ эксперті</div>
                <div className="text-xs text-white/60">математика</div>
              </div>
            </div>

            {main && (
              <div className="absolute right-0 bottom-[8%] max-w-[230px] rounded-2xl bg-gradient-to-br from-brand-600 to-navy-800 px-4 py-3 text-white shadow-glow sm:right-[-4%]">
                <div className="font-display text-3xl font-extrabold text-neptune-200">{main.value}</div>
                <div className="text-xs leading-snug text-white/80">{main.label}</div>
              </div>
            )}

            {rest[0] && (
              <div className="glass-dark absolute bottom-[26%] left-[-2%] hidden items-center gap-2 rounded-2xl bg-space-950/60 px-4 py-3 sm:flex">
                <BadgeCheck className="size-5 text-neptune-400" />
                <span className="text-sm font-bold text-white">
                  {rest[0].value} <span className="font-medium text-white/60">{rest[0].label}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Көрсеткіштер */}
      {settings.landing_stats.length > 0 && (
        <div className="relative container-page pb-12 sm:pb-16">
          <div className="glass-dark grid gap-4 rounded-3xl p-5 sm:grid-cols-3 sm:p-7">
            {settings.landing_stats.map((s, i) => (
              <div key={i} className={i > 0 ? "border-white/10 sm:border-l sm:pl-6" : ""}>
                <div className="font-display text-4xl font-extrabold sm:text-5xl">
                  <span className="text-neptune-gradient">{s.value}</span>
                </div>
                <div className="mt-1 text-sm leading-snug text-white/65">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
