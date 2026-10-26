import Link from "next/link";
import { ArrowRight, BarChart3, FilePlus2, Files, Trophy, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";
import { variantHeading } from "@/lib/video";

interface RecentRow {
  id: string;
  total_score: number | null;
  submitted_at: string | null;
  profiles: { full_name: string; email: string | null } | null;
  test_variants: { title: string; position: number } | null;
}

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [published, drafts, students, submitted, recent, scores] = await Promise.all([
    supabase.from("test_variants").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("test_variants").select("id", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("test_attempts").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase
      .from("test_attempts")
      .select("id, total_score, submitted_at, profiles(full_name, email), test_variants(title, position)")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false })
      .limit(8)
      .returns<RecentRow[]>(),
    supabase.from("test_attempts").select("total_score").eq("status", "submitted").order("submitted_at", { ascending: false }).limit(1000),
  ]);

  if (recent.error) throw new Error("Деректерді жүктеу мүмкін болмады");

  const scoreList = (scores.data ?? []).map((s) => s.total_score ?? 0);
  const avg = scoreList.length ? (scoreList.reduce((a, b) => a + b, 0) / scoreList.length).toFixed(1) : "—";

  const cards = [
    { label: "Жарияланған нұсқалар", value: published.count ?? 0, sub: `${drafts.count ?? 0} жоба (draft)`, icon: Files, href: "/admin/variants" },
    { label: "Оқушылар", value: students.count ?? 0, sub: "тіркелген", icon: Users, href: "/admin/students" },
    { label: "Тапсырылған тесттер", value: submitted.count ?? 0, sub: "барлығы", icon: BarChart3, href: "/admin/results" },
    { label: "Орташа балл", value: avg, sub: "соңғы 1000 нәтиже", icon: Trophy, href: "/admin/results" },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Платформаның жалпы көрсеткіштері"
        actions={
          <ButtonLink href="/admin/variants/new">
            <FilePlus2 className="size-4" /> Жаңа нұсқа қосу
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card group p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
            <div className="flex items-center justify-between">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-500">
                <c.icon className="size-5.5" />
              </span>
              <ArrowRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
            </div>
            <div className="mt-4 font-display text-3xl font-extrabold text-navy-900">{c.value}</div>
            <div className="mt-0.5 text-sm font-medium text-slate-700">{c.label}</div>
            <div className="text-xs text-slate-400">{c.sub}</div>
          </Link>
        ))}
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Соңғы нәтижелер</h2>
          <Link href="/admin/results" className="text-sm font-semibold text-brand-600 hover:underline">
            Барлығы →
          </Link>
        </div>
        {(recent.data ?? []).length === 0 ? (
          <EmptyState icon={BarChart3} title="Әзірге нәтиже жоқ" description="Оқушылар тест тапсырғанда нәтижелер осы жерде көрінеді." />
        ) : (
          <div className="card divide-y divide-slate-100 overflow-hidden">
            {recent.data!.map((r) => (
              <Link key={r.id} href={`/results/${r.id}`} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-navy-900">{r.profiles?.full_name || r.profiles?.email || "—"}</div>
                  <div className="truncate text-sm text-slate-500">{r.test_variants ? variantHeading(r.test_variants) : "—"}</div>
                </div>
                <div className="hidden text-sm text-slate-500 sm:block">{formatDateTime(r.submitted_at)}</div>
                <Badge tone="navy">{r.total_score}/50</Badge>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
