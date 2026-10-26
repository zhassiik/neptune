import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { coverUrl, formatPrice } from "@/lib/courses";
import { PageHeader } from "@/components/admin/PageHeader";
import { CourseCover } from "@/components/courses/CourseCover";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import type { Course } from "@/lib/types";

export const metadata: Metadata = { title: "Курстар" };

const STATUS = {
  published: { label: "Ашық", tone: "green" as const },
  coming_soon: { label: "Жақында", tone: "amber" as const },
  draft: { label: "Жоба", tone: "gray" as const },
};

export default async function AdminCoursesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").select("*, test_variants(count)").order("position").returns<(Course & { test_variants: { count: number }[] })[]>();
  if (error) throw new Error("Курстарды жүктеу мүмкін болмады");

  return (
    <>
      <PageHeader
        title="Курстар"
        description="Басты беттегі курс блоктары: мұқаба, атауы, бағасы және күйі"
        actions={
          <ButtonLink href="/admin/courses/new">
            <Plus className="size-4" /> Жаңа курс
          </ButtonLink>
        }
      />
      {(data ?? []).length === 0 ? (
        <EmptyState icon={BookOpen} title="Курс жоқ" action={<ButtonLink href="/admin/courses/new">Жаңа курс</ButtonLink>} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data!.map((c) => (
            <div key={c.id} className="card flex flex-col p-4">
              <CourseCover url={coverUrl(c.cover_path)} title={c.title} />
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                {formatPrice(c.price) && <Badge>{formatPrice(c.price)}</Badge>}
                {c.access_mode === "enrolled" && <Badge tone="navy">Тек рұқсатпен</Badge>}
                <Badge tone="blue">{c.test_variants?.[0]?.count ?? 0} нұсқа</Badge>
              </div>
              <h2 className="mt-3 flex-1 text-base leading-snug font-bold uppercase">{c.title}</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink href={`/admin/courses/${c.id}`} size="sm" variant="outline">
                  Өзгерту
                </ButtonLink>
                <ButtonLink href={`/admin/variants?course=${c.id}`} size="sm" variant="secondary">
                  Нұсқалары
                </ButtonLink>
                <Link href={`/courses/${c.slug}`} className="rounded-xl px-3 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50">
                  Сайтта ашу
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
