import { CourseGrid } from "@/components/courses/CourseGrid";
import { Hero } from "@/components/landing/Hero";
import { Testimonials } from "@/components/landing/Testimonials";
import { Countdown } from "@/components/landing/Countdown";
import { Graduates } from "@/components/landing/Graduates";
import { SevenReasons } from "@/components/landing/SevenReasons";
import { Faq } from "@/components/landing/Faq";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Alert } from "@/components/ui/Alert";
import { getVisibleCourses } from "@/lib/courses";
import { getPlatformSettings, joinCta } from "@/lib/settings";
import { getPublishedGraduates, getPublishedTestimonials } from "@/lib/landing";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, courses, settings, testimonials, graduates] = await Promise.all([
    searchParams,
    getVisibleCourses().catch(() => []),
    getPlatformSettings(),
    getPublishedTestimonials(),
    getPublishedGraduates(),
  ]);
  const firstOpen = courses.find((c) => c.status === "published");
  // «Курсқа қосылу»: Баптаулардағы WhatsApp сілтемесі (болмаса — курс беті)
  const cta = joinCta(settings, firstOpen ? `/courses/${firstOpen.slug}` : "/courses");

  return (
    <>
      {error === "forbidden" && (
        <div className="container-page pt-6">
          <Alert tone="warning">Бұл бетке тек әкімші кіре алады.</Alert>
        </div>
      )}

      <Hero settings={settings} cta={cta} />

      <SevenReasons cta={cta} />

      <section id="courses" className="container-page scroll-mt-20 pt-6 pb-16 sm:pt-8 sm:pb-24">
        <SectionHeading title="Өз курсыңды таңда" subtitle="Дайындықты бастау үшін курсты таңдаңыз." className="mb-8 sm:mb-10" />
        <CourseGrid />
      </section>

      {testimonials.length > 0 && <Testimonials items={testimonials} />}

      {graduates.length > 0 && <Graduates items={graduates} />}

      <Faq />

      {settings.exam_date && <Countdown title={settings.exam_countdown_title} date={settings.exam_date} cta={cta} />}
    </>
  );
}
