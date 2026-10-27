"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { FormState } from "@/lib/admin/actions";
import { cn, toAlmatyInput } from "@/lib/utils";
import { almatyDate, almatyTime } from "@/lib/weekly";

export interface ScheduleVariant {
  id: string;
  heading: string;
  week_id: string | null;
  otherWeekTitle: string | null;
  contest_starts_at: string | null;
  contest_ends_at: string | null;
  classroom_url: string | null;
  homework_deadline: string | null;
}

/** Бір нұсқаның апталық кестесі: аптаға қосу, уақыт аралығы, Classroom, дедлайн */
export function VariantScheduleRow({ v, weekId, action }: { v: ScheduleVariant; weekId: string; action: (prev: FormState, fd: FormData) => Promise<FormState> }) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [inWeek, setInWeek] = useState(v.week_id === weekId);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className={cn("rounded-2xl border p-4 transition", inWeek ? "border-amber-200 bg-amber-50/40" : "border-slate-100 bg-white")} noValidate>
      <input type="hidden" name="variant_id" value={v.id} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" name="in_week" checked={inWeek} onChange={(e) => setInWeek(e.target.checked)} className="size-5 accent-amber-500" />
          <span className="font-semibold text-navy-900">{v.heading}</span>
        </label>
        {v.otherWeekTitle && !inWeek && <span className="text-xs font-medium text-slate-500">Қазір: {v.otherWeekTitle}</span>}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[150px_100px_100px]">
        <label className="text-xs font-medium text-slate-500">
          Апта үздігі күні
          <Input type="date" name="date" defaultValue={almatyDate(v.contest_starts_at)} className="mt-1 py-2" disabled={!inWeek} />
        </label>
        <label className="text-xs font-medium text-slate-500">
          Басталуы
          <Input type="time" name="from" defaultValue={almatyTime(v.contest_starts_at) || "05:00"} className="mt-1 py-2" disabled={!inWeek} />
        </label>
        <label className="text-xs font-medium text-slate-500">
          Аяқталуы
          <Input type="time" name="to" defaultValue={almatyTime(v.contest_ends_at) || "06:30"} className="mt-1 py-2" disabled={!inWeek} />
        </label>
      </div>
      {fe.window && <p className="field-error">{fe.window}</p>}

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_210px]">
        <label className="text-xs font-medium text-slate-500">
          Черновик/конспект: Classroom сілтемесі
          <Input type="url" name="classroom_url" defaultValue={v.classroom_url ?? ""} placeholder="https://classroom.google.com/..." className="mt-1 py-2" invalid={!!fe.classroom_url} />
        </label>
        <label className="text-xs font-medium text-slate-500">
          Дедлайн (Алматы)
          <Input type="datetime-local" name="homework_deadline" defaultValue={toAlmatyInput(v.homework_deadline)} className="mt-1 py-2" invalid={!!fe.homework_deadline} />
        </label>
      </div>
      {(fe.classroom_url || fe.homework_deadline) && <p className="field-error">{fe.classroom_url || fe.homework_deadline}</p>}

      <div className="mt-3 flex items-center gap-3">
        <SubmitButton size="sm" pendingText="Сақталуда...">
          Сақтау
        </SubmitButton>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.message && <span className="text-sm text-emerald-700">{state.message}</span>}
      </div>
    </form>
  );
}
