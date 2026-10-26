import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/PageHeader";
import { CourseForm } from "@/components/admin/CourseForm";
import { createCourse } from "@/lib/admin/actions";

export const metadata: Metadata = { title: "Жаңа курс" };

export default function NewCoursePage() {
  return (
    <>
      <PageHeader title="Жаңа курс" />
      <div className="card max-w-2xl p-6 sm:p-8">
        <CourseForm action={createCourse} submitLabel="Курсты құру" />
      </div>
    </>
  );
}
