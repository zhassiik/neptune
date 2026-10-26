import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { RoleToggle } from "@/components/admin/RoleToggle";
import { Input } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { formatDateTime } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Оқушылар" };

const PAGE_SIZE = 25;

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; role?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(sp.page) || 1);
  const role = sp.role === "admin" ? "admin" : "student";
  const me = await getCurrentUser();
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at", { count: "exact" })
    .eq("role", role)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
  }
  const { data, count, error } = await query.returns<Profile[]>();
  if (error) throw new Error("Оқушылар тізімін жүктеу мүмкін болмады");

  const ids = (data ?? []).map((p) => p.id);
  const stats = new Map<string, { count: number; best: number; last: string | null }>();
  if (ids.length) {
    const { data: attempts } = await supabase
      .from("test_attempts")
      .select("student_id, total_score, submitted_at")
      .eq("status", "submitted")
      .in("student_id", ids);
    for (const a of attempts ?? []) {
      const s = stats.get(a.student_id) ?? { count: 0, best: 0, last: null };
      s.count += 1;
      s.best = Math.max(s.best, a.total_score ?? 0);
      if (!s.last || (a.submitted_at && a.submitted_at > s.last)) s.last = a.submitted_at;
      stats.set(a.student_id, s);
    }
  }

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);
  const href = (p: number) => `/admin/students?${new URLSearchParams({ ...(q && { q }), ...(role === "admin" && { role }), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Оқушылар" description={`Барлығы: ${count ?? 0}`} />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {(["student", "admin"] as const).map((r) => (
            <Link
              key={r}
              href={r === "admin" ? "/admin/students?role=admin" : "/admin/students"}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${role === r ? "bg-navy-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              {r === "student" ? "Оқушылар" : "Әкімшілер"}
            </Link>
          ))}
        </div>
        <form className="flex gap-2" role="search">
          {role === "admin" && <input type="hidden" name="role" value="admin" />}
          <div className="relative flex-1 sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} placeholder="Аты-жөні немесе email" className="pl-9" aria-label="Іздеу" />
          </div>
          <SubmitButton variant="outline">Іздеу</SubmitButton>
        </form>
      </div>

      {(data ?? []).length === 0 ? (
        <EmptyState icon={Users} title={q ? "Ештеңе табылмады" : "Әзірге тіркелген оқушы жоқ"} description={q ? "Басқа сөзбен іздеп көріңіз." : undefined} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Аты-жөні</th>
                <th className="px-5 py-3 font-semibold">Тіркелген күні</th>
                <th className="px-5 py-3 font-semibold">Тесттер</th>
                <th className="px-5 py-3 font-semibold">Ең жоғары</th>
                <th className="px-5 py-3 font-semibold">Соңғы тест</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data!.map((p) => {
                const s = stats.get(p.id);
                return (
                  <tr key={p.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-navy-900">{p.full_name || "—"}</div>
                      <div className="text-slate-500">{p.email}</div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{formatDateTime(p.created_at)}</td>
                    <td className="px-5 py-3.5">{s?.count ?? 0}</td>
                    <td className="px-5 py-3.5">{s ? <Badge tone="navy">{s.best}/50</Badge> : "—"}</td>
                    <td className="px-5 py-3.5 text-slate-600">{formatDateTime(s?.last)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        {s && (
                          <Link href={`/admin/results?student=${encodeURIComponent(p.email ?? p.full_name)}`} className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50">
                            Нәтижелері
                          </Link>
                        )}
                        {p.id !== me?.id && <RoleToggle userId={p.id} name={p.full_name || p.email || ""} role={p.role} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} buildHref={href} />
    </>
  );
}
