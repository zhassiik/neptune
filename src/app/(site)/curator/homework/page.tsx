import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, NotebookPen } from "lucide-react";
import { requireCuratorPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCuratorCourses } from "@/lib/curator";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { variantHeading } from "@/lib/video";
import type { TestVariant } from "@/lib/types";

export const metadata: Metadata = { title: "Черновик және конспект" };

/** Куратор: өз курстарының нұсқалары — черновик/конспект белгілеуге */
export default async function CuratorHomeworkPage() {
  const user = await requireCuratorPage("/curator/homework");
  const supabase = await createClient();
  const courses = await getCuratorCourses(supabase, user);

  let variants: TestVariant[] = [];
  if (courses.length) {
    const { data } = await supabase
      .from("test_variants")
      .select("*")
      .in("course_id", courses.map((c) => c.id))
      .eq("status", "published")
      .order("position");
    variants = ((data ?? []) as TestVariant[]).filter((v) => (v.kind ?? "ubt") === "ubt");
  }

  return (
    <>
      <h1 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
        <NotebookPen className="size-7 text-brand-500" /> Черновик және конспект
      </h1>
      <p className="mt-1 text-slate-500">Нұсқаны таңдап, оқушылардың черновигі мен конспектісін тексеріп, галочка қойыңыз.</p>

      {courses.length === 0 ? (
        <Alert tone="info" className="mt-6">
          Сізге әлі ешбір курс бекітілмеген. Әкімшіге хабарласыңыз.
        </Alert>
      ) : (
        <div className="mt-6 space-y-6">
          {courses.map((c) => {
            const list = variants.filter((v) => v.course_id === c.id);
            return (
              <section key={c.id}>
                <h2 className="mb-2 text-lg font-bold">{c.title}</h2>
                {list.length === 0 ? (
                  <p className="text-sm text-slate-500">Бұл курста жарияланған нұсқа жоқ.</p>
                ) : (
                  <ul className="card divide-y divide-slate-100 overflow-hidden">
                    {list.map((v) => {
                      const hasLinks = !!(v.draft_url || v.notes_url || v.classroom_url);
                      return (
                        <li key={v.id}>
                          <Link href={`/curator/homework/${v.id}`} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50">
                            <span className="min-w-0 flex-1 truncate font-medium text-navy-900">{variantHeading(v)}</span>
                            <Badge tone={hasLinks ? "green" : "gray"}>{hasLinks ? "Classroom бар" : "Сілтеме жоқ"}</Badge>
                            <ChevronRight className="size-4 shrink-0 text-slate-400" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
