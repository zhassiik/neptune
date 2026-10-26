import { ArrowRight, CheckCircle2, Clock, Target } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { CourseGrid } from "@/components/courses/CourseGrid";
import { getVisibleCourses } from "@/lib/courses";
import { Alert } from "@/components/ui/Alert";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, courses] = await Promise.all([searchParams, getVisibleCourses().catch(() => [])]);
  const firstOpen = courses.find((c) => c.status === "published");
  return (
    <>
      {error === "forbidden" && (
        <div className="container-page pt-6">
          <Alert tone="warning">Бұл бетке тек әкімші кіре алады.</Alert>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_80%_-10%,var(--color-brand-100),transparent_60%),radial-gradient(40rem_24rem_at_-10%_10%,var(--color-brand-50),transparent_60%)]" />
        <div className="container-page grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white px-3.5 py-1.5 text-sm font-medium text-brand-700 shadow-sm">
              <span className="size-2 rounded-full bg-brand-500" /> ҰБТ форматындағы онлайн нұсқалар
            </span>
            <h1 className="mt-6 text-4xl leading-[1.08] font-extrabold sm:text-5xl lg:text-6xl">
              ҰБТ-ға <span className="text-brand-500">сенімді</span> дайындал
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
              Авторлық математика нұсқаларын ҰБТ форматында орында. Жүйе жауаптарыңды бірден тексеріп,
              балыңды есептейді, ал әр нұсқаның толық видео-талдауы қатеңді түсінуге көмектеседі.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={firstOpen ? `/courses/${firstOpen.slug}` : "/courses"} size="lg">
                Нұсқаларды бастау <ArrowRight className="size-5" />
              </ButtonLink>
              <ButtonLink href="/courses" size="lg" variant="outline">
                Курстар
              </ButtonLink>
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-4">
              {[
                { k: "40", v: "сұрақ" },
                { k: "50", v: "максималды балл" },
                { k: "1 мин", v: "нәтиже дайын" },
              ].map((s) => (
                <div key={s.v}>
                  <dt className="font-display text-2xl font-extrabold text-navy-900 sm:text-3xl">{s.k}</dt>
                  <dd className="mt-1 text-sm text-slate-500">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Декоративті превью */}
          <div className="relative hidden lg:block" aria-hidden>
            <div className="card rotate-1 p-6 shadow-lift">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-navy-800">Математика | НҰСҚА №1</span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-sm font-semibold text-brand-700">
                  <Clock className="size-4" /> 01:12:40
                </span>
              </div>
              <div className="mt-5 h-28 rounded-2xl bg-gradient-to-br from-brand-50 to-white ring-1 ring-brand-100" />
              <div className="mt-4 space-y-2.5">
                {["A", "B", "C", "D"].map((l, i) => (
                  <div key={l} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${i === 1 ? "border-brand-400 bg-brand-50" : "border-slate-100"}`}>
                    <span className={`grid size-6 place-items-center rounded-full text-xs font-bold ${i === 1 ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500"}`}>{l}</span>
                    <span className="h-2 flex-1 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-10 gap-1.5">
                {Array.from({ length: 20 }).map((_, i) => (
                  <span key={i} className={`h-6 rounded-md ${i < 7 ? "bg-brand-500" : i === 7 ? "bg-white ring-2 ring-navy-800" : "bg-slate-100"}`} />
                ))}
              </div>
            </div>
            <div className="card absolute -bottom-8 -left-10 flex items-center gap-3 px-5 py-4">
              <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <Target className="size-5" />
              </span>
              <div>
                <div className="font-display text-xl font-extrabold text-navy-900">42/50</div>
                <div className="text-xs text-slate-500">Соңғы нәтиже</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Курстар */}
      <section id="courses" className="container-page pb-20 sm:pb-28">
        <div className="mb-8 flex flex-col gap-2 sm:mb-10">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Курстар</h2>
          <p className="text-slate-500">Дайындықты бастау үшін бөлімді таңдаңыз.</p>
        </div>
        <CourseGrid />
        <ul className="mt-8 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
          {["Жауаптар автоматты сақталады", "Әр нұсқаның видео-талдауы", "Телефоннан да ыңғайлы"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <CheckCircle2 className="size-4.5 text-brand-500" /> {t}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
