import { ClipboardCheck, PlayCircle, Sparkles, Sunrise, Target, UserCheck, type LucideIcon } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

const FEATURES: { icon: LucideIcon; title: string; text: string; tint: string }[] = [
  {
    icon: Sunrise,
    title: "Таңғы 5:00 — нұсқа талдау",
    text: "Күн сайын таң атпай жаңа нұсқа мен оның толық талдауы. Таң берекесімен бастаған күн өнімді өтеді.",
    tint: "from-amber-400 to-orange-500",
  },
  {
    icon: ClipboardCheck,
    title: "Нағыз ҰБТ форматы",
    text: "Бір жауапты, бірнеше жауапты және сәйкестендіру сұрақтары — емтихандағыдай құрылым мен уақыт.",
    tint: "from-brand-400 to-brand-600",
  },
  {
    icon: PlayCircle,
    title: "Әр нұсқаға видео-талдау",
    text: "Шешу жолын мұғалімнің өзі түсіндіреді. Түсінбеген жеріңді қайта-қайта көре аласың.",
    tint: "from-neptune-400 to-brand-500",
  },
  {
    icon: Target,
    title: "Балың бірден шығады",
    text: "Тест біткен сәтте нәтиже есептеледі — қай тақырыпта қате жібергеніңді бірден көресің.",
    tint: "from-emerald-400 to-teal-500",
  },
  {
    icon: UserCheck,
    title: "Куратор бақылауы",
    text: "Куратор нәтижеңді қадағалап, черновик пен конспектіңді тексеріп, белгі қояды.",
    tint: "from-violet-400 to-indigo-500",
  },
  {
    icon: Sparkles,
    title: "«Менің жұлдызым»",
    text: "Күн сайын нұсқа орындасаң — жұлдызың өседі. Тұрақты дайындық әдетке айналады.",
    tint: "from-fuchsia-400 to-pink-500",
  },
];

const STEPS = [
  { n: "01", title: "Тіркел", text: "Email арқылы бір минутта аккаунт аш" },
  { n: "02", title: "Курсқа қосыл", text: "Мұғаліммен байланысып, курсқа рұқсат ал" },
  { n: "03", title: "Күн сайын орында", text: "Таңғы нұсқаны шығарып, видео-талдауды көр" },
  { n: "04", title: "50/50-ге жет", text: "Нәтижеңді бақылап, қателеріңмен жұмыс істе" },
];

/** «Неге Neptune?» — платформаның мүмкіндіктері және дайындықтың 4 қадамы */
export function Features() {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-slate-50 to-white py-16 sm:py-24">
      {/* Жұмсақ нүктелі тор — ғарыш тақырыбының ашық нұсқасы */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(rgb(47_107_240/0.09)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent_85%)] [background-size:22px_22px]"
        aria-hidden
      />
      <div className="container-page">
        <SectionHeading
          eyebrow="Неге Neptune?"
          title={
            <>
              Дайындық <span className="text-brand-600">жүйелі</span> болғанда ғана нәтиже береді
            </>
          }
          subtitle="Бір платформада: күнделікті нұсқа, видео-талдау, куратор бақылауы және өз прогресіңді көру."
          align="center"
          className="mx-auto"
        />

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {FEATURES.map(({ icon: Icon, title, text, tint }) => (
            <li
              key={title}
              className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-brand-100 hover:shadow-lift"
            >
              <span className={`grid size-12 place-items-center rounded-2xl bg-gradient-to-br ${tint} text-white shadow-soft`}>
                <Icon className="size-6" aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-extrabold">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{text}</p>
              <span
                className={`pointer-events-none absolute -right-10 -bottom-10 size-32 rounded-full bg-gradient-to-br ${tint} opacity-0 blur-2xl transition duration-500 group-hover:opacity-20`}
                aria-hidden
              />
            </li>
          ))}
        </ul>

        {/* Дайындық жолы: 4 қадам, орбита сызығымен байланысқан */}
        <div className="space-bg relative isolate mt-14 overflow-hidden rounded-[2rem] px-5 py-8 sm:px-8 sm:py-10">
          <div className="stars" aria-hidden />
          <h3 className="relative text-center text-xl font-extrabold text-white sm:text-2xl">Сенің жолың — 4 қадам</h3>
          <ol className="relative mt-8 grid grid-cols-2 gap-x-3 gap-y-7 lg:grid-cols-4 lg:gap-4">
            <span className="absolute top-6 right-[12%] left-[12%] hidden border-t-2 border-dashed border-neptune-400/30 lg:block" aria-hidden />
            {STEPS.map((s) => (
              <li key={s.n} className="relative flex flex-col items-center text-center">
                <span className="grid size-12 place-items-center rounded-full bg-navy-900 font-display text-lg font-extrabold text-neptune-300 shadow-glow ring-1 ring-neptune-400/40">
                  {s.n}
                </span>
                <span className="mt-3 font-display text-lg font-extrabold text-white">{s.title}</span>
                <span className="mt-1 max-w-[16rem] text-sm leading-relaxed text-white/70">{s.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
