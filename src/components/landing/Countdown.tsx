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
      <div className="stars" aria-hidden />
      <svg viewBox="0 0 1200 400" className="pointer-events-none absolute inset-0 size-full text-neptune-400/20" fill="none" preserveAspectRatio="none" aria-hidden>
        <ellipse cx="600" cy="200" rx="560" ry="150" stroke="currentColor" strokeWidth="2" />
        <ellipse cx="600" cy="200" rx="420" ry="95" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 12" />
      </svg>
      <div className="container-page relative text-center">
        <h2 className="text-2xl font-extrabold text-white sm:text-4xl">{title}</h2>
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
