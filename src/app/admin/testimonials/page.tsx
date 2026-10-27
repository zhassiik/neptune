import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MessageSquareQuote, Plus, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { siteMediaUrl } from "@/lib/landing";
import { PageHeader } from "@/components/admin/PageHeader";
import { DeleteTestimonialButton } from "@/components/admin/DeleteTestimonialButton";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/States";
import type { Testimonial } from "@/lib/types";

export const metadata: Metadata = { title: "Пікірлер" };

export default async function AdminTestimonialsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("testimonials").select("*").order("position").order("created_at", { ascending: false }).returns<Testimonial[]>();

  return (
    <>
      <PageHeader
        title="Оқушылардың пікірлері"
        description="Басты беттегі «Оқушыларымыздың нәтижелері» блогы"
        actions={
          <ButtonLink href="/admin/testimonials/new">
            <Plus className="size-4" /> Жаңа пікір
          </ButtonLink>
        }
      />
      {saved && <Alert tone="success" className="mb-5">Пікір сақталды.</Alert>}
      {error ? (
        <Alert tone="error">Пікірлер кестесі табылмады: Supabase SQL Editor-да 20261030000001_landing.sql migration-ын іске қосыңыз.</Alert>
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={MessageSquareQuote}
          title="Әзірге пікір жоқ"
          description="Пікір қосылғанда, ол басты бетте «Оқушыларымыздың нәтижелері» блогында көрінеді."
          action={<ButtonLink href="/admin/testimonials/new">Пікір қосу</ButtonLink>}
        />
      ) : (
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {data!.map((t) => {
            const url = siteMediaUrl(t.photo_path);
            return (
              <div key={t.id} className="flex items-center gap-4 px-5 py-4">
                <span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-brand-50">
                  {url ? <Image src={url} alt="" fill sizes="48px" className="object-cover" /> : <UserRound className="m-3 size-6 text-brand-400" />}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/testimonials/${t.id}`} className="font-semibold text-navy-900 hover:text-brand-600">
                    {t.student_name}
                  </Link>
                  <p className="truncate text-sm text-slate-500">{t.text}</p>
                </div>
                {t.score != null && <Badge tone="blue">{t.score_label || `${t.score} балл`}</Badge>}
                <Badge tone={t.is_published ? "green" : "gray"}>{t.is_published ? "Көрінеді" : "Жасырын"}</Badge>
                <ButtonLink href={`/admin/testimonials/${t.id}`} size="sm" variant="outline">
                  Өзгерту
                </ButtonLink>
                <DeleteTestimonialButton id={t.id} name={t.student_name} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
