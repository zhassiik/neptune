"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { countdownParts, type CountdownParts } from "@/lib/countdown";

/** «3 қаңтар ҰБТ-ға дейін» кері санағы (мәтіні мен күні — Баптауларда) */
export function Countdown({ title, date, cta }: { title: string; date: string; cta: { href: string; external: boolean } }) {
  const target = new Date(date).getTime();
  const [parts, setParts] = useState<CountdownParts | null>(null);

  useEffect(() => {
    const tick = () => setParts(countdownParts(Date.now(), target));
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [target]);

  if (parts?.done) return null;

  const boxes = [
    { v: parts?.months, l: "Ай" },
    { v: parts?.days, l: "Күн" },
    { v: parts?.hours, l: "Сағат" },
    { v: parts?.minutes, l: "Минут" },
  ];

  return (
    <section className="space-bg relative isolate overflow-hidden py-14 sm:py-20">
      {/* Фон қозғалысы: тұман толқиды, жұлдыздар жылжиды, орбита бойымен кометалар айналады */}
      <div className="nebula-drift pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[140%] w-[70%] rounded-full bg-[radial-gradient(closest-side,rgb(79_220_251/0.16),rgb(124_92_255/0.08)_55%,transparent)] blur-2xl" aria-hidden />
      <div className="stars stars-drift" aria-hidden />
      <svg viewBox="0 0 1200 400" className="pointer-events-none absolute inset-0 size-full text-neptune-400/20" fill="none" preserveAspectRatio="none" aria-hidden>
        <defs>
          <radialGradient id="comet-glow">
            <stop offset="0" stopColor="#e0faff" />
            <stop offset="0.35" stopColor="#4fdcfb" stopOpacity="0.9" />
            <stop offset="1" stopColor="#4fdcfb" stopOpacity="0" />
          </radialGradient>
          <path id="orbit-outer" d="M40 200 A560 150 0 1 1 1160 200 A560 150 0 1 1 40 200" />
          <path id="orbit-inner" d="M1020 200 A420 95 0 1 1 180 200 A420 95 0 1 1 1020 200" />
        </defs>
        <ellipse cx="600" cy="200" rx="560" ry="150" stroke="currentColor" strokeWidth="2" />
        <ellipse className="dash-flow" cx="600" cy="200" rx="420" ry="95" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 12" />
        <g className="motion-reduce:hidden">
          <g>
            <ellipse rx="16" ry="10" fill="url(#comet-glow)" opacity="0.7" />
            <circle r="3.2" fill="#e0faff" />
            <animateMotion dur="22s" repeatCount="indefinite">
              <mpath href="#orbit-outer" />
            </animateMotion>
          </g>
          <g>
            <ellipse rx="11" ry="7" fill="url(#comet-glow)" opacity="0.6" />
            <circle r="2.4" fill="#c4b5fd" />
            <animateMotion dur="15s" repeatCount="indefinite">
              <mpath href="#orbit-inner" />
            </animateMotion>
          </g>
        </g>
      </svg>
      <div className="container-page relative text-center">
        {/* Баптауда кіші әріппен жазылса да, тақырып бас әріппен басталады */}
        <h2 className="text-2xl font-extrabold text-white sm:text-4xl">{title.charAt(0).toLocaleUpperCase("kk") + title.slice(1)}</h2>
        <div className="mx-auto mt-8 grid max-w-3xl grid-cols-4 gap-2 sm:gap-5" role="timer" aria-live="off">
          {boxes.map((b) => (
            <div key={b.l} className="glass-dark rounded-2xl px-1 py-4 sm:rounded-3xl sm:py-7">
              <div className="font-display text-3xl font-extrabold text-neptune-200 tabular-nums [text-shadow:0_0_24px_rgb(79_220_251/0.5)] sm:text-6xl">{b.v === undefined ? "--" : String(b.v).padStart(2, "0")}</div>
              <div className="mt-1 text-xs text-white/70 sm:text-sm">{b.l}</div>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-9 flex max-w-xl flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-5">
          <Link
            href={cta.href}
            {...(cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="inline-flex h-13 items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-neptune-500 px-7 font-bold text-white shadow-glow transition hover:brightness-110 active:scale-[0.97]"
          >
            Курсқа қосылу <ArrowRight className="size-5" />
          </Link>
          <p className="text-sm text-white/70 sm:text-left">
            ҰБТ-ға дайындықты қазір баста —<br className="hidden sm:block" /> арманыңдағы университетке бірге жетеміз
          </p>
        </div>
      </div>
    </section>
  );
}
