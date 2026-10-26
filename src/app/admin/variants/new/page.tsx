import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/PageHeader";
import { VariantForm } from "@/components/admin/VariantForm";
import { createVariant } from "@/lib/admin/actions";
import { loadCourseOptions } from "@/lib/admin/editor-data";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Жаңа нұсқа" };

export default async function NewVariantPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const { course } = await searchParams;
  const { courses, nextPositions } = await loadCourseOptions();
  const ordered = course ? [...courses].sort((a, b) => (a.id === course ? -1 : b.id === course ? 1 : 0)) : courses;

  return (
    <>
      <PageHeader
        title="Жаңа нұсқа қосу"
        description="Курсты, нөмірін және атауын енгізіңіз. Келесі қадамда 40 скринді жүктеп, дұрыс жауаптарды белгілейсіз."
      />
      {courses.length === 0 ? (
        <Alert tone="warning">
          Алдымен курс құрыңыз. <ButtonLink href="/admin/courses/new" size="sm" className="ml-2">Курс құру</ButtonLink>
        </Alert>
      ) : (
        <div className="card max-w-2xl p-6 sm:p-8">
          <VariantForm action={createVariant} submitLabel="Құру және скриндерді жүктеу" courses={ordered} nextPositions={nextPositions} />
        </div>
      )}
    </>
  );
}
