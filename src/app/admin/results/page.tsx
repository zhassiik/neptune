import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, FilterX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pagination } from "@/components/admin/Pagination";
import { DeleteAttemptButton } from "@/components/admin/DeleteAttemptButton";
import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { formatDateTime, formatDuration, percent } from "@/lib/utils";
import { variantHeading } from "@/lib/video";

export const metadata: Metadata = { title: "Нәтижелер" };

const PAGE_SIZE = 25;

interface Row {
  id: string;
  total_score: number | null;
  max_score: number;
  correct_count: number | null;
  partial_count: number | null;
  incorrect_count: number | null;
  unanswered_count: number | null;
  started_at: string;
  submitted_at: string | null;
  profiles: { full_name: string; email: string | null };
  test_variants: { id: string; title: string; position: number } | null;
}

type SP = { student?: string; variant?: string; from?: string; to?: string; min?: string; max?: string; sort?: string; page?: string };

const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isScore = (v?: string) => !!v && /^\d{1,2}$/.test(v) && Number(v) <= 50;

export default async function ResultsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const student = (sp.student ?? "").trim().slice(0, 100);
  const supabase = await createClient();

  const { data: variants } = await supabase.from("test_variants").select("id, title, position, courses(title)").order("position").returns<{ id: string; title: string; position: number; courses: { title: string } | null }[]>();

  let query = supabase
    .from("test_attempts")
    .select(
      "id, total_score, max_score, correct_count, partial_count, incorrect_count, unanswered_count, started_at, submitted_at, profiles!inner(full_name, email), test_variants(id, title, position)",
      { count: "exact" },
    )
    .eq("status", "submitted");

  if (student) {
    const safe = student.replace(/[%,()]/g, " ");
    query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`, { referencedTable: "profiles" });
  }
  if (sp.variant && /^[0-9a-f-]{36}$/i.test(sp.variant)) query = query.eq("variant_id", sp.variant);
  // Күндер Алматы уақыты бойынша (UTC+5)
  if (isDate(sp.from)) query = query.gte("submitted_at", `${sp.from}T00:00:00+05:00`);
  if (isDate(sp.to)) query = query.lte("submitted_at", `${sp.to}T23:59:59.999+05:00`);
  if (isScore(sp.min)) query = query.gte("total_score", Number(sp.min));
  if (isScore(sp.max)) query = query.lte("total_score", Number(sp.max));

  const sort = sp.sort === "score_desc" || sp.sort === "score_asc" || sp.sort === "date_asc" ? sp.sort : "date_desc";
  query =
    sort === "score_desc"
      ? query.order("total_score", { ascending: false }).order("submitted_at", { ascending: false })
      : sort === "score_asc"
        ? query.order("total_score", { ascending: true })
        : query.order("submitted_at", { ascending: sort === "date_asc" });

  const { data, count, error } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1).returns<Row[]>();
  if (error) throw new Error("Нәтижелерді жүктеу мүмкін болмады");

  const filtersActive = Boolean(student || sp.variant || sp.from || sp.to || sp.min || sp.max);
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);
  const href = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "page") params.set(k, v);
    params.set("page", String(p));
    return `/admin/results?${params}`;
  };

  return (
    <>
      <PageHeader title="Нәтижелер" description={`Табылды: ${count ?? 0} нәтиже`} />

      <form className="card mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Сүзгілер">
        <Field id="student" label="Оқушы">
          <Input id="student" name="student" defaultValue={student} placeholder="Аты-жөні немесе email" />
        </Field>
        <Field id="variant" label="Нұсқа">
          <Select id="variant" name="variant" defaultValue={sp.variant ?? ""}>
            <option value="">Барлық нұсқалар</option>
            {(variants ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {variantHeading(v)} — {v.courses?.title}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field id="from" label="Күннен">
            <Input id="from" name="from" type="date" defaultValue={isDate(sp.from) ? sp.from : ""} />
          </Field>
          <Field id="to" label="Күнге дейін">
            <Input id="to" name="to" type="date" defaultValue={isDate(sp.to) ? sp.to : ""} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field id="min" label="Балл (мин)">
            <Input id="min" name="min" type="number" min={0} max={50} defaultValue={isScore(sp.min) ? sp.min : ""} placeholder="0" />
          </Field>
          <Field id="max" label="Балл (макс)">
            <Input id="max" name="max" type="number" min={0} max={50} defaultValue={isScore(sp.max) ? sp.max : ""} placeholder="50" />
          </Field>
        </div>
        <Field id="sort" label="Сұрыптау">
          <Select id="sort" name="sort" defaultValue={sort}>
            <option value="date_desc">Күні: жаңадан ескіге</option>
            <option value="date_asc">Күні: ескіден жаңаға</option>
            <option value="score_desc">Балл: жоғарыдан төмен</option>
            <option value="score_asc">Балл: төменнен жоғары</option>
          </Select>
        </Field>
        <div className="flex items-end gap-2 sm:col-span-1 lg:col-span-3 lg:justify-end">
          {filtersActive && (
            <ButtonLink href="/admin/results" variant="ghost">
              <FilterX className="size-4" /> Тазалау
            </ButtonLink>
          )}
          <SubmitButton pendingText="Іздеуде...">Сүзу</SubmitButton>
        </div>
      </form>

      {(data ?? []).length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title={filtersActive ? "Сүзгіге сәйкес нәтиже жоқ" : "Әзірге нәтиже жоқ"}
          description={filtersActive ? "Сүзгі параметрлерін өзгертіп көріңіз." : "Оқушылар тест тапсырғанда нәтижелер осы жерде көрінеді."}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Оқушы</th>
                <th className="px-5 py-3 font-semibold">Нұсқа</th>
                <th className="px-5 py-3 font-semibold">Күні</th>
                <th className="px-5 py-3 font-semibold">Ұзақтығы</th>
                <th className="px-5 py-3 font-semibold" title="Дұрыс / Жартылай / Қате / Жауапсыз">
                  Д / Ж / Қ / Б
                </th>
                <th className="px-5 py-3 font-semibold">Балл</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data!.map((r) => {
                const p = percent(r.total_score, r.max_score);
                return (
                  <tr key={r.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-navy-900">{r.profiles.full_name || "—"}</div>
                      <div className="text-slate-500">{r.profiles.email}</div>
                    </td>
                    <td className="max-w-56 truncate px-5 py-3.5 text-slate-700">{r.test_variants ? variantHeading(r.test_variants) : "—"}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-600">{formatDateTime(r.submitted_at)}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-600">{formatDuration(r.started_at, r.submitted_at)}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-emerald-600">{r.correct_count}</span> / <span className="text-amber-600">{r.partial_count}</span> /{" "}
                      <span className="text-red-600">{r.incorrect_count}</span> / <span className="text-slate-500">{r.unanswered_count}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-base font-extrabold text-navy-900">{r.total_score}/50</span>
                        <Badge tone={p >= 80 ? "green" : p >= 50 ? "blue" : p >= 30 ? "amber" : "red"}>{p}%</Badge>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/results/${r.id}`} className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50">
                          Талдау
                        </Link>
                        <DeleteAttemptButton attemptId={r.id} label={`${r.profiles.full_name || r.profiles.email} — ${r.test_variants ? variantHeading(r.test_variants) : ""}`} />
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
