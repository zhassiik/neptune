import { ChevronDown } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

const ITEMS: { q: string; a: string }[] = [
  {
    q: "Курсқа қалай жазыламын?",
    a: "«Курсқа қосылу» батырмасын басып, мұғаліммен байланысыңыз. Сайтқа тіркелген email-іңізді айтасыз — курс сол аккаунтқа ашылады.",
  },
  {
    q: "Нұсқалар қашан шығады?",
    a: "Күн сайын таңғы 5-те жаңа нұсқа мен оның видео-талдауы жарияланады. Нұсқаны өзіңізге ыңғайлы уақытта орындай аласыз.",
  },
  {
    q: "Видеоны қай құрылғыдан көруге болады?",
    a: "Телефоннан да, компьютерден де. Қауіпсіздік үшін бір аккаунт шектеулі құрылғыда ғана ашылады, сондықтан аккаунтыңызды басқа адамға бермеңіз.",
  },
  {
    q: "Черновик пен конспект деген не?",
    a: "Әр нұсқаның астында Classroom-ға сілтеме бар. Шешу жолыңызды (черновик) және конспектіңізді сонда тапсырасыз, куратор тексеріп белгі қояды.",
  },
  {
    q: "Нәтижемді кім көреді?",
    a: "Тек сіз және курстың кураторы. Басқа оқушылар сіздің балыңызды көрмейді.",
  },
  {
    q: "«Менің жұлдызым» қалай өседі?",
    a: "Дүйсенбі, сейсенбі, сәрсенбі, жұма және сенбі күндері жаңа нұсқа шығады — оны сол күні 00:00-ге дейін орындасаңыз, жұлдыз өседі. Бейсенбі мен жексенбі — демалыс: жаңа нұсқа жоқ, жұлдыз сақталып тұрады.",
  },
];

/** Жиі қойылатын сұрақтар — JS-сіз ашылатын <details> аккордеоны */
export function Faq() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <SectionHeading
          eyebrow="Сұрақ-жауап"
          title="Жиі қойылатын сұрақтар"
          subtitle="Жауабын таппасаңыз — «Курсқа қосылу» батырмасы арқылы бізге жазыңыз."
          className="lg:sticky lg:top-24 lg:self-start"
        />
        <div className="space-y-3">
          {ITEMS.map((item, i) => (
            <details
              key={item.q}
              name="faq"
              open={i === 0}
              className="group rounded-2xl border border-slate-200 bg-white transition open:border-brand-200 open:bg-brand-50/40 open:shadow-soft"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 font-display text-base font-bold text-navy-900 sm:text-lg [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition group-open:rotate-180 group-open:bg-brand-500 group-open:text-white">
                  <ChevronDown className="size-4" aria-hidden />
                </span>
              </summary>
              <p className="px-5 pb-5 text-[15px] leading-relaxed text-slate-600">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
