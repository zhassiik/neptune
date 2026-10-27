import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/PageHeader";
import { TestimonialForm } from "@/components/admin/TestimonialForm";
import { createTestimonial } from "@/lib/admin/actions";

export const metadata: Metadata = { title: "Жаңа пікір" };

export default function NewTestimonialPage() {
  return (
    <>
      <PageHeader title="Жаңа пікір" />
      <div className="card max-w-2xl p-6 sm:p-8">
        <TestimonialForm action={createTestimonial} submitLabel="Пікірді қосу" />
      </div>
    </>
  );
}
