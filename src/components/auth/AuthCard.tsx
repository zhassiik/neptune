import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

const PERKS = ["Күн сайын таңғы 5-те жаңа нұсқа", "Әр нұсқаға видео-талдау", "Нәтижең бірден есептеледі", "Куратор бақылауы және «Менің жұлдызым»"];

/** Кіру/тіркелу беті: сол жақта — ғарыш панелі (үлкен экранда), оң жақта — форма */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden bg-gradient-to-b from-brand-50/60 to-white py-10 sm:py-16">
      <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 mx-auto h-80 max-w-3xl rounded-full bg-brand-100/60 blur-3xl" aria-hidden />
      <div className="container-page">
        <div className="mx-auto grid w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-lift lg:max-w-5xl lg:grid-cols-[1fr_1.05fr]">
          {/* Ғарыш панелі */}
          <aside className="space-bg relative isolate hidden overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between">
            <div className="stars stars-drift" aria-hidden />
            <div className="pointer-events-none absolute -right-24 -bottom-24 size-80 rounded-full bg-gradient-to-br from-neptune-400/70 via-brand-600/60 to-navy-800 shadow-glow" aria-hidden>
              <div className="planet-surface size-full rounded-full bg-[repeating-linear-gradient(170deg,transparent_0_18px,rgb(255_255_255/0.07)_18px_30px)]" />
            </div>
            <div className="relative">
              <span className="glass-dark inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold tracking-[0.14em] text-neptune-200 uppercase">
                <span className="size-1.5 rounded-full bg-neptune-400 shadow-[0_0_8px_var(--color-neptune-400)]" aria-hidden /> Neptune UBT
              </span>
              <p className="mt-6 font-display text-3xl leading-tight font-extrabold text-white">
                Таң берекесімен <span className="text-neptune-gradient">50/50</span> баллға қарай
              </p>
              <ul className="mt-7 space-y-3">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5 text-[15px] text-white/85">
                    <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-neptune-400" aria-hidden /> {perk}
                  </li>
                ))}
              </ul>
            </div>
            <p className="relative mt-10 text-sm text-white/50">ҰБТ математикасына дайындық платформасы</p>
          </aside>

          {/* Форма */}
          <div className="animate-fade-in p-6 sm:p-10">
            <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
            <p className="mt-2 text-slate-500">{subtitle}</p>
            <div className="mt-7">{children}</div>
            <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">{footer}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
