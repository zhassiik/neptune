import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { siteMediaUrl } from "@/lib/landing";
import { PageHeader } from "@/components/admin/PageHeader";
import { TestimonialForm } from "@/components/admin/TestimonialForm";
import { ButtonLink } from "@/components/ui/Button";
import { updateTestimonial } from "@/lib/admin/actions";
import type { Testimonial } from "@/lib/types";

export const metadata: Metadata = { title: "Пікірді өзгерту" };

export default async function EditTestimonialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("testimonials").select("*").eq("id", id).maybeSingle<Testimonial>();
  if (!data) notFound();
  return (
    <>
      <ButtonLink href="/admin/testimonials" variant="ghost" size="sm" className="-ml-3 mb-2">
        <ArrowLeft className="size-4" /> Пікірлер
      </ButtonLink>
      <PageHeader title={data.student_name} />
      <div className="card max-w-2xl p-6 sm:p-8">
        <TestimonialForm action={updateTestimonial.bind(null, data.id)} initial={data} initialPhotoUrl={siteMediaUrl(data.photo_path)} submitLabel="Сақтау" />
      </div>
    </>
  );
}
