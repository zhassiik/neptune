import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { WeekForm } from "@/components/admin/weekly/WeekForm";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/States";
import { createWeek } from "@/lib/admin/weekly-actions";

export const metadata: Metadata = { title: "Апта үздігі" };

interface WeekRow {
  id: string;
  title: string;
  position: number;
  is_published: boolean;
  courses: { title: string } | null;
  test_variants: { count: number }[];
}

export default async function AdminWeeklyPage() {
  const supabase = await createClient();
  const [{ data: weeks, error }, { data: courses }] = await Promise.all([
    supabase
      .from("contest_weeks")
      .select("id, title, position, is_published, courses(title), test_variants(count)")
      .order("position", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<WeekRow[]>(),
    supabase.from("courses").select("id, title").order("position"),
  ]);

  return (
    <>
      <PageHeader title="Апта үздігі" description="Апталық конкурс: нұсқалардың ашылу уақыты, черновик/конспект тексерісі және рейтинг" />
      {error ? (
        <Alert tone="error">Апталар кестесі табылмады: Supabase SQL Editor-да 20261031000001_weekly_contest.sql migration-ын іске қосыңыз.</Alert>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div>
            {(weeks ?? []).length === 0 ? (
              <EmptyState icon={Trophy} title="Әзірге апта жоқ" description="Оң жақтағы формамен «1-апта» құрып, оған нұсқаларды қосыңыз." />
            ) : (
              <div className="card divide-y divide-slate-100 overflow-hidden">
                {weeks!.map((w) => (
                  <Link key={w.id} href={`/admin/weekly/${w.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50">
                    <span className="grid size-11 place-items-center rounded-xl bg-amber-50 text-amber-600">
                      <Trophy className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-navy-900">{w.title}</div>
                      <div className="text-sm text-slate-500">{w.courses?.title}</div>
                    </div>
                    <Badge tone="blue">{w.test_variants?.[0]?.count ?? 0} нұсқа</Badge>
                    <Badge tone={w.is_published ? "green" : "gray"}>{w.is_published ? "Көрінеді" : "Жасырын"}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <section className="card h-fit p-6">
            <h2 className="mb-4 text-lg font-bold">Жаңа апта</h2>
            <WeekForm action={createWeek} courses={courses ?? []} submitLabel="Құру" />
          </section>
        </div>
      )}
    </>
  );
}
