import { CourseGrid } from "@/components/courses/CourseGrid";
import { Hero } from "@/components/landing/Hero";
import { Testimonials } from "@/components/landing/Testimonials";
import { Countdown } from "@/components/landing/Countdown";
import { Alert } from "@/components/ui/Alert";
import { getVisibleCourses } from "@/lib/courses";
import { getPlatformSettings, joinCta } from "@/lib/settings";
import { getPublishedTestimonials } from "@/lib/landing";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, courses, settings, testimonials] = await Promise.all([
    searchParams,
    getVisibleCourses().catch(() => []),
    getPlatformSettings(),
    getPublishedTestimonials(),
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

      <section id="courses" className="container-page py-16 sm:py-24">
        <div className="mb-8 flex flex-col gap-2 sm:mb-10">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Курстар</h2>
          <p className="text-slate-500">Дайындықты бастау үшін курсты таңдаңыз.</p>
        </div>
        <CourseGrid />
      </section>

      {testimonials.length > 0 && <Testimonials items={testimonials} />}

      {settings.exam_date && <Countdown title={settings.exam_countdown_title} date={settings.exam_date} cta={cta} />}
    </>
  );
}
