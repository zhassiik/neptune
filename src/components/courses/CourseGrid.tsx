import { BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getVisibleCourses } from "@/lib/courses";
import { EmptyState } from "@/components/ui/States";
import { CourseCard } from "./CourseCard";

export async function CourseGrid() {
  const courses = await getVisibleCourses();
  if (courses.length === 0) {
    return <EmptyState icon={BookOpen} title="Әзірге курс жоқ" description="Курстар жақында қосылады." />;
  }

  const supabase = await createClient();
  const { data } = await supabase.from("test_variants").select("course_id").eq("status", "published");
  const counts = new Map<string, number>();
  for (const v of data ?? []) counts.set(v.course_id, (counts.get(v.course_id) ?? 0) + 1);

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => (
        <CourseCard key={c.id} course={c} variantsCount={counts.get(c.id)} />
      ))}
    </div>
  );
}
