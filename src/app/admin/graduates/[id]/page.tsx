import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { siteMediaUrl } from "@/lib/landing";
import { PageHeader } from "@/components/admin/PageHeader";
import { GraduateForm } from "@/components/admin/GraduateForm";
import { ButtonLink } from "@/components/ui/Button";
import { updateGraduate } from "@/lib/admin/graduate-actions";
import type { Graduate } from "@/lib/types";

export const metadata: Metadata = { title: "Түлекті өзгерту" };

export default async function EditGraduatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("graduates").select("*").eq("id", id).maybeSingle<Graduate>();
  if (!data) notFound();
  return (
    <>
      <ButtonLink href="/admin/graduates" variant="ghost" size="sm" className="-ml-3 mb-2">
        <ArrowLeft className="size-4" /> Түлектер
      </ButtonLink>
      <PageHeader title={data.student_name} />
      <div className="card max-w-3xl p-6 sm:p-8">
        <GraduateForm
          action={updateGraduate.bind(null, data.id)}
          initial={data}
          initialPhotoUrl={siteMediaUrl(data.photo_path)}
          initialCertificateUrl={siteMediaUrl(data.certificate_path)}
          submitLabel="Сақтау"
        />
      </div>
    </>
  );
}
