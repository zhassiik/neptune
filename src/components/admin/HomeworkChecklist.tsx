"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { useToast } from "@/components/admin/Toast";
import { setHomeworkStatus } from "@/lib/admin/homework-actions";
import { cn } from "@/lib/utils";
import type { HomeworkStatus } from "@/lib/types";

export interface ChecklistStudent {
  id: string;
  name: string;
  email: string | null;
  draft: HomeworkStatus | null;
  notes: HomeworkStatus | null;
}

type Kind = "draft" | "notes";
const LABEL: Record<Kind, string> = { draft: "Черновик", notes: "Конспект" };

/** Галочка = «расталды». «Кеш» / «Missed» — галочка емес */
const isDone = (s: HomeworkStatus | null) => s === "on_time";

/**
 * Куратор: оқушы черновик/конспектті орындаса — галочка қояды (бірден сақталады).
 * Галочка = «расталды»: оқушыға курс бетінде ✓ болып көрінеді.
 */
export function HomeworkChecklist({ variantId, students }: { variantId: string; students: ChecklistStudent[] }) {
  const toast = useToast();
  const [rows, setRows] = useState(students);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const counts = { draft: rows.filter((r) => isDone(r.draft)).length, notes: rows.filter((r) => isDone(r.notes)).length };

  const toggle = (student: ChecklistStudent, kind: Kind) => {
    const key = `${student.id}:${kind}`;
    if (busy) return;
    const next: HomeworkStatus | null = isDone(student[kind]) ? null : "on_time";
    const prev = student[kind];
    setBusy(key);
    setRows((list) => list.map((r) => (r.id === student.id ? { ...r, [kind]: next } : r)));
    start(async () => {
      const res = await setHomeworkStatus(variantId, student.id, kind, next);
      if (res.error) {
        setRows((list) => list.map((r) => (r.id === student.id ? { ...r, [kind]: prev } : r)));
        toast(res.error, "error");
      }
      setBusy(null);
    });
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <label className="relative block sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Аты немесе email бойынша іздеу"
            className="field-input pl-9"
            aria-label="Оқушыны іздеу"
          />
        </label>
        <div className="flex gap-2 text-sm">
          {(["draft", "notes"] as const).map((k) => (
            <span key={k} className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
              {LABEL[k]}: {counts[k]}/{rows.length}
            </span>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">{rows.length ? "Ешкім табылмады" : "Бұл курста әзірге оқушы жоқ"}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0">
                <div className="truncate font-medium text-navy-900">{s.name}</div>
                {s.email && <div className="truncate text-xs text-slate-500">{s.email}</div>}
              </div>
              <div className="flex shrink-0 gap-2">
                {(["draft", "notes"] as const).map((kind) => {
                  const done = isDone(s[kind]);
                  const key = `${s.id}:${kind}`;
                  return (
                    <button
                      key={kind}
                      type="button"
                      role="checkbox"
                      aria-checked={done}
                      aria-label={`${s.name}: ${LABEL[kind]}`}
                      onClick={() => toggle(s, kind)}
                      disabled={!!busy && busy !== key}
                      className={cn(
                        "inline-flex h-9 min-w-[124px] items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-60",
                        done
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : s[kind] === "late" || s[kind] === "missing"
                            ? "border-red-300 bg-red-50 text-red-700"
                            : "border-slate-200 bg-white text-slate-500 hover:border-brand-300 hover:text-brand-700",
                      )}
                    >
                      {busy === key ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <span className={cn("grid size-4 place-items-center rounded border", done ? "border-current bg-current" : "border-slate-300")}>
                          {done && <Check className="size-3 text-white" strokeWidth={3} />}
                        </span>
                      )}
                      {LABEL[kind]}
                      {s[kind] === "late" && <span className="text-xs font-medium">(кеш)</span>}
                      {s[kind] === "missing" && <span className="text-xs font-medium">(missed)</span>}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
