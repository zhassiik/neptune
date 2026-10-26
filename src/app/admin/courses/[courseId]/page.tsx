import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { coverUrl } from "@/lib/courses";
import { PageHeader } from "@/components/admin/PageHeader";
import { CourseForm } from "@/components/admin/CourseForm";
import { DeleteCourseButton } from "@/components/admin/DeleteCourseButton";
import { EnrollmentManager, type EnrollmentRow } from "@/components/admin/EnrollmentManager";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { updateCourse } from "@/lib/admin/actions";
import type { Course } from "@/lib/types";

export const metadata: Metadata = { title: "Курсты өзгерту" };

export default async function EditCoursePage({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ courseId }, { created }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) notFound();
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("*").eq("id", courseId).maybeSingle<Course>();
  if (!course) notFound();

  const { data: enrollments } = await supabase
    .from("course_enrollments")
    .select("student_id, created_at, profiles!course_enrollments_student_id_fkey(full_name, email)")
    .eq("course_id", course.id)
    .order("created_at", { ascending: false })
    .returns<{ student_id: string; created_at: string; profiles: { full_name: string; email: string | null } | null }[]>();
  const rows: EnrollmentRow[] = (enrollments ?? []).map((e) => ({
    student_id: e.student_id,
    created_at: e.created_at,
    full_name: e.profiles?.full_name ?? "",
    email: e.profiles?.email ?? null,
  }));

  return (
    <>
      <PageHeader
        title={course.title}
        description={`/courses/${course.slug}`}
        actions={
          <>
            <ButtonLink href={`/admin/variants/new?course=${course.id}`}>Нұсқа қосу</ButtonLink>
            <DeleteCourseButton courseId={course.id} title={course.title} />
          </>
        }
      />
      {created && (
        <Alert tone="success" className="mb-5 max-w-2xl">
          Курс құрылды.
        </Alert>
      )}
      <div className="card max-w-2xl p-6 sm:p-8">
        <CourseForm action={updateCourse.bind(null, course.id)} initial={course} initialCoverUrl={coverUrl(course.cover_path)} submitLabel="Сақтау" />
      </div>
      <EnrollmentManager courseId={course.id} accessMode={course.access_mode} rows={rows} />
    </>
  );
}
