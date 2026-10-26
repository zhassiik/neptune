import type { Metadata } from "next";
import Link from "next/link";
import { Clock, FilePlus2, Files } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { VariantRowActions } from "@/components/admin/VariantRowActions";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { formatDateTime } from "@/lib/utils";
import type { TestVariant } from "@/lib/types";
import { hasVideo, variantHeading } from "@/lib/video";

export const metadata: Metadata = { title: "Нұсқалар" };

type Row = TestVariant & { questions: { count: number }[]; test_attempts: { count: number }[]; courses: { title: string } | null };

export default async function AdminVariantsPage({ searchParams }: { searchParams: Promise<{ status?: string; course?: string }> }) {
  const { status, course } = await searchParams;
  const supabase = await createClient();
  const { data: courses } = await supabase.from("courses").select("id, title").order("position");
  let query = supabase
    .from("test_variants")
    .select("*, questions(count), test_attempts(count), courses(title)")
    .order("position")
    .order("created_at");
  if (status === "draft" || status === "published") query = query.eq("status", status);
  if (course && /^[0-9a-f-]{36}$/i.test(course)) query = query.eq("course_id", course);
  const link = (patch: { status?: string; course?: string }) => {
    const p = new URLSearchParams();
    const next = { status, course, ...patch };
    if (next.status) p.set("status", next.status);
    if (next.course) p.set("course", next.course);
    return `/admin/variants${p.size ? `?${p}` : ""}`;
  };
  const { data, error } = await query.returns<Row[]>();
  if (error) throw new Error("Нұсқаларды жүктеу мүмкін болмады");

  const tabs = [
    { key: undefined, label: "Барлығы" },
    { key: "published", label: "Жарияланған" },
    { key: "draft", label: "Жоба (draft)" },
  ];

  return (
    <>
      <PageHeader
        title="Нұсқалар"
        description="Нұсқаларды құру, өзгерту, жариялау және өшіру"
        actions={
          <ButtonLink href={course ? `/admin/variants/new?course=${course}` : "/admin/variants/new"}>
            <FilePlus2 className="size-4" /> Жаңа нұсқа қосу
          </ButtonLink>
        }
      />

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {[{ id: undefined, title: "Барлық курстар" }, ...(courses ?? [])].map((c) => (
          <Link
            key={c.id ?? "all"}
            href={link({ course: c.id })}
            className={`max-w-72 shrink-0 truncate rounded-xl px-4 py-2 text-sm font-semibold transition ${course === c.id ? "bg-brand-500 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {c.title}
          </Link>
        ))}
      </div>
      <div className="mb-5 flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <Link
            key={t.label}
            href={link({ status: t.key })}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${status === t.key ? "bg-navy-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {(data ?? []).length === 0 ? (
        <EmptyState
          icon={Files}
          title="Нұсқа табылмады"
          description="Алғашқы ҰБТ нұсқасын құрып, оған 40 сұрақ қосыңыз."
          action={<ButtonLink href="/admin/variants/new">Жаңа нұсқа қосу</ButtonLink>}
        />
      ) : (
        <div className="grid gap-4">
          {data!.map((v) => {
            const qCount = v.questions?.[0]?.count ?? 0;
            const aCount = v.test_attempts?.[0]?.count ?? 0;
            return (
              <article key={v.id} className="card p-5 sm:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={v.status === "published" ? "green" : "amber"}>{v.status === "published" ? "Жарияланған" : "Draft"}</Badge>
                      {hasVideo(v) && <Badge tone="navy">{v.video_provider === "cloudflare" ? "Cloudflare видео" : "Видео бар"}</Badge>}
                      {v.time_limit_minutes && (
                        <Badge>
                          <Clock className="size-3" /> {v.time_limit_minutes} мин
                        </Badge>
                      )}
                    </div>
                    <Link href={`/admin/variants/${v.id}`} className="mt-2 block text-lg font-bold text-navy-900 hover:text-brand-600">
                      {variantHeading(v)}
                    </Link>
                    <div className="text-sm font-medium text-brand-700">{v.courses?.title}</div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span>
                        Сұрақтар: <b className={qCount === 40 ? "text-emerald-600" : "text-amber-600"}>{qCount}/40</b>
                      </span>
                      <span>Талпыныстар: {aCount}</span>
                      <span>Жаңартылды: {formatDateTime(v.updated_at)}</span>
                    </div>
                    <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${qCount === 40 ? "bg-emerald-500" : "bg-brand-500"}`} style={{ width: `${(qCount / 40) * 100}%` }} />
                    </div>
                  </div>
                  <VariantRowActions id={v.id} title={variantHeading(v)} status={v.status} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
