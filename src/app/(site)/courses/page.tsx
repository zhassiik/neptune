import type { Metadata } from "next";
import { CourseGrid } from "@/components/courses/CourseGrid";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SpaceBand } from "@/components/ui/SpaceBand";

export const metadata: Metadata = { title: "Курстар" };
export const dynamic = "force-dynamic";

export default function CoursesPage() {
  return (
    <>
      <SpaceBand innerClassName="pb-24 sm:pb-28">
        <SectionHeading
          as="h1"
          dark
          eyebrow="Neptune UBT"
          title={
            <>
              ҰБТ математикасына <span className="text-neptune-gradient">дайындық курстары</span>
            </>
          }
          subtitle="Күнделікті нұсқалар, видео-талдаулар және жүйелі дайындық — өзіңе лайық курсты таңда."
        />
      </SpaceBand>
      <div className="container-page relative -mt-16 pb-16 sm:-mt-20 sm:pb-20">
        <CourseGrid />
      </div>
    </>
  );
}
