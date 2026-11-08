import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { GraduateForm } from "@/components/admin/GraduateForm";
import { ButtonLink } from "@/components/ui/Button";
import { createGraduate } from "@/lib/admin/graduate-actions";

export const metadata: Metadata = { title: "Жаңа түлек" };

export default function NewGraduatePage() {
  return (
    <>
      <ButtonLink href="/admin/graduates" variant="ghost" size="sm" className="-ml-3 mb-2">
        <ArrowLeft className="size-4" /> Түлектер
      </ButtonLink>
      <PageHeader title="Жаңа түлек" />
      <div className="card max-w-3xl p-6 sm:p-8">
        <GraduateForm action={createGraduate} submitLabel="Түлекті қосу" />
      </div>
    </>
  );
}
