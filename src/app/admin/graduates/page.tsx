import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Award, GraduationCap, Plus, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { siteMediaUrl } from "@/lib/landing";
import { PageHeader } from "@/components/admin/PageHeader";
import { DeleteGraduateButton } from "@/components/admin/DeleteGraduateButton";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/States";
import type { Graduate } from "@/lib/types";

export const metadata: Metadata = { title: "Түлектер" };

export default async function AdminGraduatesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("graduates").select("*").order("position").order("created_at", { ascending: false }).returns<Graduate[]>();

  return (
    <>
      <PageHeader
        title="Түлектердің нәтижелері"
        description="Басты беттегі «Neptune курсының түлектерінің нәтижелері» блогы: фото, пікір және сертификат"
        actions={
          <ButtonLink href="/admin/graduates/new">
            <Plus className="size-4" /> Жаңа түлек
          </ButtonLink>
        }
      />
      {saved && <Alert tone="success" className="mb-5">Түлек сақталды.</Alert>}
      {error ? (
        <Alert tone="error">Түлектер кестесі табылмады: Supabase SQL Editor-да 20261110000001_graduates.sql migration-ын іске қосыңыз.</Alert>
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Әзірге түлек жоқ"
          description="Түлек қосылғанда, ол басты бетте «Қаңтар ҰБТ-ға дейін қалды» блогының алдында көрінеді."
          action={<ButtonLink href="/admin/graduates/new">Түлек қосу</ButtonLink>}
        />
      ) : (
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {data!.map((g) => {
            const url = siteMediaUrl(g.photo_path);
            return (
              <div key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                <span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-brand-50">
                  {url ? <Image src={url} alt="" fill sizes="48px" className="object-cover" /> : <UserRound className="m-3 size-6 text-brand-400" />}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/graduates/${g.id}`} className="font-semibold text-navy-900 hover:text-brand-600">
                    {g.student_name}
                  </Link>
                  <p className="truncate text-sm text-slate-500">{g.text}</p>
                </div>
                {g.score != null && <Badge tone="blue">{g.score_label || `${g.score} балл`}</Badge>}
                <Badge tone={g.certificate_path ? "green" : "amber"}>
                  <Award className="size-3.5" /> {g.certificate_path ? "Сертификат бар" : "Сертификат жоқ"}
                </Badge>
                <Badge tone={g.is_published ? "green" : "gray"}>{g.is_published ? "Көрінеді" : "Жасырын"}</Badge>
                <ButtonLink href={`/admin/graduates/${g.id}`} size="sm" variant="outline">
                  Өзгерту
                </ButtonLink>
                <DeleteGraduateButton id={g.id} name={g.student_name} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
