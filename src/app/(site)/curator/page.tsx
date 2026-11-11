import { StudentPhones } from "@/components/ui/StudentPhones";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, Search } from "lucide-react";
import { requireCuratorPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCuratorCourses } from "@/lib/curator";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/States";
import { formatDateTime, percent } from "@/lib/utils";
import { variantHeading } from "@/lib/video";

export const metadata: Metadata = { title: "Оқушылар нәтижесі" };

interface Row {
  id: string;
  total_score: number | null;
  max_score: number;
  submitted_at: string | null;
  profiles: { full_name: string; email: string | null; phone?: string | null; parent_phone?: string | null } | null;
  test_variants: { title: string; position: number; kind?: string; course_id: string; courses: { title: string } | null } | null;
}

/** Куратор: өз курстарындағы оқушылардың тест нәтижелері (RLS — тек бекітілген курстар) */
export default async function CuratorResultsPage({ searchParams }: { searchParams: Promise<{ course?: string; q?: string }> }) {
  const [user, sp] = await Promise.all([requireCuratorPage(), searchParams]);
  const supabase = await createClient();
  const courses = await getCuratorCourses(supabase, user);
  const course = courses.find((c) => c.id === sp.course)?.id ?? null;
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 100);

  let rows: Row[] = [];
  let failed = false;
  if (courses.length) {
    const query = supabase
      .from("test_attempts")
      .select("id, total_score, max_score, submitted_at, profiles(*), test_variants!inner(*, courses(title))")
      .eq("status", "submitted")
      .in("test_variants.course_id", course ? [course] : courses.map((c) => c.id))
      .order("submitted_at", { ascending: false })
      .limit(500);
    const { data, error } = await query.returns<Row[]>();
    failed = !!error;
    rows = (data ?? []).filter((r) => !q || `${r.profiles?.full_name ?? ""} ${r.profiles?.email ?? ""}`.toLowerCase().includes(q));
  }

  return (
    <>
      <h1 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
        <BarChart3 className="size-7 text-brand-500" /> Оқушылар нәтижесі
      </h1>
      <p className="mt-1 text-slate-500">Өзіңізге бекітілген курстардағы оқушылардың тест нәтижелері. Толық талдауын ашу үшін жолды басыңыз.</p>

      {courses.length === 0 ? (
        <Alert tone="info" className="mt-6">
          Сізге әлі ешбір курс бекітілмеген. Әкімшіге хабарласыңыз.
        </Alert>
      ) : (
        <>
          <form className="mt-6 flex flex-col gap-2 sm:flex-row" role="search">
            <Select name="course" defaultValue={course ?? ""} className="sm:w-72" aria-label="Курс">
              <option value="">Барлық курстар</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input name="q" defaultValue={sp.q ?? ""} placeholder="Оқушының аты немесе email" className="pl-9" aria-label="Оқушыны іздеу" />
            </div>
            <button type="submit" className="h-11 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white transition hover:bg-brand-600">
              Көрсету
            </button>
          </form>

          {failed && (
            <Alert tone="error" className="mt-5">
              Нәтижелерді жүктеу мүмкін болмады. Бетті жаңартып көріңіз.
            </Alert>
          )}

          {rows.length === 0 ? (
            <div className="mt-6">
              <EmptyState icon={BarChart3} title="Нәтиже жоқ" description="Оқушылар тест тапсырғанда, нәтижелері осы жерде көрінеді." />
            </div>
          ) : (
            <div className="card mt-6 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Оқушы</th>
                    <th className="px-5 py-3 font-semibold">Тест</th>
                    <th className="px-5 py-3 font-semibold">Балл</th>
                    <th className="px-5 py-3 font-semibold">Күні</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => {
                    const p = percent(r.total_score, r.max_score);
                    return (
                      <tr key={r.id} className="transition hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <div className="font-semibold text-navy-900">{r.profiles?.full_name || "Оқушы"}</div>
                          <div className="text-xs text-slate-500">{r.profiles?.email}</div>
                          <StudentPhones phone={r.profiles?.phone} parentPhone={r.profiles?.parent_phone} className="mt-1" />
                        </td>
                        <td className="px-5 py-3">
                          <div className="font-medium text-navy-900">{r.test_variants ? variantHeading(r.test_variants) : "—"}</div>
                          <div className="text-xs text-slate-500">{r.test_variants?.courses?.title}</div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={p >= 80 ? "green" : p >= 50 ? "blue" : p >= 30 ? "amber" : "red"}>
                            {r.total_score}/{r.max_score}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{formatDateTime(r.submitted_at)}</td>
                        <td className="px-5 py-3 text-right">
                          <Link href={`/results/${r.id}`} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50">
                            Талдау <ArrowRight className="size-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
