import Link from "next/link";
import { ArrowRight, CornerDownRight } from "lucide-react";

/** «Таңғы 200 нұсқа талдауға қатысудың 7 себебі» — мәтін апайдың Instagram постынан */
const REASONS: { intro: string; point: string; answer: string }[] = [
  {
    intro: "2027 жылғы нағыз ҰБТ-ның Математика есептері күрделі болады.",
    point: "Есептер білу емес, қолдану деңгейінде келеді. Жоғары балл алу үшін қолдану деңгейіндегі есептерді шығарып, өте көп практика жасап кіруің керек.",
    answer: "Таңғы 200 нұсқа талдау эфирі дәл осы практиканы береді.",
  },
  {
    intro: "ҰБТ тапсыру барысында берілетін 4 сағаттың 1,5 сағатын Математикаға арнамасаң, басқа пәндерге үлгермейсің.",
    point: "Нәтижесінде грантқа қажетті балды жинай алмай қаласың.",
    answer: "Таңғы 200 нұсқа талдау эфирі дәл осы уақытқа жұмыс жасауды үйретеді.",
  },
  {
    intro: "Математикадан 50/50 балл алу үшін, қай тақырыптан нашар екеніңді анықтап, сол тақырыптарға көбірек есеп шығаруың керек.",
    point: "Ал мықты білетін тақырыбыңды одан әрі шыңдау үшін түрлі деңгейдегі есептерді шығаруың қажет.",
    answer: "Таңғы 200 нұсқа талдау эфирі дәл сондай есептерді береді.",
  },
  {
    intro: "Нағыз ҰБТ есептері қатты шатастырады. Тіпті көзге оңай көрінгенінің өзіне дұрыстап қарамасаң қадап жібереді.",
    point: "Барлық тақырыпты біліп, барлық есепті шығара алып тұрсаң да, балың төмен болып қалады.",
    answer: "Осындай есептерден шатаспау үшін таңғы 200 нұсқа талдау эфирі саған асқан қырағылық пен мұқияттылықты үйретеді.",
  },
  {
    intro: "Өз біліміне сенімсіз оқушыда нағыз ҰБТ алдында уайым мен қорқыныш болады.",
    point: "Ал біліміне сенімді оқушыда бұл сезімдер автоматты түрде жойылып, сенімділікпен алмасады.",
    answer: "Таңғы 200 нұсқа талдау эфирі саған дәл осы сенімділікті береді.",
  },
  {
    intro: "ҰБТ-ға дайындалу барысында жаныңда мықты ортаның болуы аса маңызды.",
    point: "Олар өз кезегінде сенің мотивацияңның өшіп қалмауына, жалығып кетпеуіңе септігін тигізеді. Жарыса есеп шығарып, деңгейіңнің көтерілуіне ықпал етеді.",
    answer: "Таңғы 200 нұсқа талдау эфирі сені дәл осындай ортамен қамтамасыз етеді.",
  },
  {
    intro: "2027 жылғы ҰБТ-ны тапсырушылар саны былтырғымен салыстырғанда әлдеқайда көп.",
    point: "Сәйкесінше грантқа түсу шансың аз болады деген сөз. Кім соңғы финишке тормозить етіп қалмай, газды басады — сол бәрін басып озады.",
    answer: "Таңғы 200 нұсқа талдау эфирі сені нағыз финишке дейін мықты қып дайындайды.",
  },
];

/** «ҰБТ-ның» сияқты сөздер дефистен бөлінбесін (бөлінбейтін дефис U+2011) */
const nb = (t: string) => t.replace(/(\S)-(\S)/g, "$1\u2011$2");

export function SevenReasons({ cta }: { cta: { href: string; external: boolean } }) {
  const ctaClass =
    "inline-flex min-h-12 items-center gap-2 rounded-xl bg-navy-900 px-6 text-base font-semibold text-white shadow-lift transition hover:bg-navy-800 active:scale-[0.98]";
  return (
    <section className="relative bg-gradient-to-b from-slate-50 to-white py-16 sm:py-24">
      <div className="container-page grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        {/* Тақырып пен батырма — үлкен экранда айналдырғанда тұрып қалады */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="text-3xl leading-tight font-extrabold text-balance sm:text-5xl">
            Таңғы 200 нұсқа талдауға қатысудың <span className="text-brand-600">7 себебі</span>
          </h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-pretty text-slate-600">ҰБТ 2027 · онлайн оқыту · математика</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            {cta.external ? (
              <a href={cta.href} target="_blank" rel="noopener noreferrer" className={ctaClass}>
                Эфирге қатысу <ArrowRight className="size-5" aria-hidden />
              </a>
            ) : (
              <Link href={cta.href} className={ctaClass}>
                Эфирге қатысу <ArrowRight className="size-5" aria-hidden />
              </Link>
            )}
            <Link href="#courses" className="inline-flex min-h-12 items-center rounded-xl px-5 text-base font-semibold text-navy-900 transition hover:bg-slate-100">
              Курстарды көру
            </Link>
          </div>
        </div>

        <ol className="divide-y divide-slate-200 border-y border-slate-200">
          {REASONS.map((r, i) => (
            <li key={i} className="grid grid-cols-[3rem_1fr] gap-x-4 py-7 sm:grid-cols-[4.5rem_1fr] sm:gap-x-6 sm:py-9">
              <span className="font-display text-4xl leading-none font-extrabold text-brand-500 tabular-nums sm:text-6xl" aria-label={`${i + 1}-себебі`}>
                {i + 1}
              </span>
              <div>
                <p className="text-[15px] leading-relaxed text-slate-600 sm:text-base">{nb(r.intro)}</p>
                <p className="mt-2 text-[15px] leading-relaxed font-semibold text-navy-900 sm:text-base">{nb(r.point)}</p>
                <p className="mt-4 flex items-start gap-2.5 rounded-xl bg-brand-50 px-4 py-3 text-[15px] leading-snug font-semibold text-navy-800 ring-1 ring-brand-100">
                  <CornerDownRight className="mt-0.5 size-4.5 shrink-0 text-brand-500" aria-hidden />
                  {nb(r.answer)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
