"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { useToast } from "@/components/admin/Toast";
import { setHomeworkStatus } from "@/lib/admin/weekly-actions";
import { cn } from "@/lib/utils";
import { formatPoints, homeworkPoints } from "@/lib/weekly";
import type { HomeworkStatus } from "@/lib/types";

export interface GridStudent {
  id: string;
  name: string;
  email: string | null;
}

const OPTIONS: { value: HomeworkStatus | ""; label: string }[] = [
  { value: "", label: "—" },
  { value: "on_time", label: "Уақытында" },
  { value: "late", label: "Кешікті" },
  { value: "missing", label: "Салмады" },
];

const TONE: Record<string, string> = {
  on_time: "border-emerald-300 bg-emerald-50 text-emerald-800",
  late: "border-amber-300 bg-amber-50 text-amber-900",
  missing: "border-red-300 bg-red-50 text-red-700",
  "": "border-slate-200 bg-white text-slate-500",
};

type Key = `${string}:${string}:${"draft" | "notes"}`;

/**
 * Куратордың тексеру кестесі: жолдар — оқушылар, бағандар — нұсқалар (черновик / конспект).
 * Әр өзгеріс бірден сақталады.
 */
export function HomeworkGrid({
  variants,
  students,
  initial,
}: {
  variants: { id: string; label: string }[];
  students: GridStudent[];
  initial: Record<string, { draft_status: HomeworkStatus | null; notes_status: HomeworkStatus | null }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<Record<Key, string>>(() => {
    const v: Record<Key, string> = {};
    for (const [k, h] of Object.entries(initial)) {
      v[`${k}:draft` as Key] = h.draft_status ?? "";
      v[`${k}:notes` as Key] = h.notes_status ?? "";
    }
    return v;
  });
  const [saving, setSaving] = useState<Key | null>(null);
  const [saved, setSaved] = useState<Key | null>(null);
  const [, start] = useTransition();

  const change = (variantId: string, studentId: string, kind: "draft" | "notes", value: string) => {
    const key = `${variantId}:${studentId}:${kind}` as Key;
    const prev = values[key] ?? "";
    setValues((v) => ({ ...v, [key]: value }));
    setSaving(key);
    start(async () => {
      const r = await setHomeworkStatus(variantId, studentId, kind, value || null);
      setSaving(null);
      if (r.error) {
        setValues((v) => ({ ...v, [key]: prev }));
        toast(r.error, "error");
      } else {
        setSaved(key);
        setTimeout(() => setSaved((s) => (s === key ? null : s)), 1500);
        router.refresh();
      }
    });
  };

  if (!variants.length) return <p className="text-sm text-slate-500">Аптаға нұсқа қосылмаған.</p>;
  if (!students.length) return <p className="text-sm text-slate-500">Әзірге оқушы жоқ: оқушылар осы аптаның нұсқасын тапсырғанда немесе курсқа рұқсат алғанда осы жерде пайда болады.</p>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-semibold">Оқушы</th>
            {variants.map((v) => (
              <th key={v.id} className="px-3 py-3 text-center font-semibold" colSpan={2}>
                {v.label}
                <div className="mt-0.5 font-normal text-slate-400">Черновик · Конспект</div>
              </th>
            ))}
            <th className="px-4 py-3 text-right font-semibold">Ұпай</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {students.map((s) => {
            let total = 0;
            return (
              <tr key={s.id} className="hover:bg-slate-50/50">
                <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                  <div className="font-semibold text-navy-900">{s.name}</div>
                  <div className="text-xs text-slate-400">{s.email}</div>
                </td>
                {variants.map((v) =>
                  (["draft", "notes"] as const).map((kind) => {
                    const key = `${v.id}:${s.id}:${kind}` as Key;
                    const value = values[key] ?? "";
                    total += homeworkPoints((value || null) as HomeworkStatus | null, kind);
                    return (
                      <td key={key} className="px-1.5 py-2">
                        <div className="relative">
                          <select
                            value={value}
                            onChange={(e) => change(v.id, s.id, kind, e.target.value)}
                            className={cn("w-28 appearance-none rounded-lg border px-2 py-1.5 text-xs font-semibold transition focus:ring-2 focus:ring-brand-200 focus:outline-none", TONE[value])}
                            aria-label={`${s.name}: ${v.label} ${kind === "draft" ? "черновик" : "конспект"}`}
                          >
                            {OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          {saving === key && <Loader2 className="absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 animate-spin text-slate-400" />}
                          {saved === key && <Check className="absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 text-emerald-600" />}
                        </div>
                      </td>
                    );
                  }),
                )}
                <td className="px-4 py-2.5 text-right font-display font-extrabold text-navy-900">+{formatPoints(total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
