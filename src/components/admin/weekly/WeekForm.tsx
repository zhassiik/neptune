"use client";

import { useActionState } from "react";
import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import type { FormState } from "@/lib/admin/actions";
import type { ContestWeek } from "@/lib/types";

export function WeekForm({
  action,
  initial,
  courses,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: Partial<ContestWeek>;
  /** Жаңа апта үшін курс таңдау */
  courses?: { id: string; title: string }[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      {courses && (
        <Field id="course_id" label="Курс" error={fe.course_id}>
          <Select id="course_id" name="course_id" defaultValue={courses[0]?.id}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <Field id="title" label="Атауы" error={fe.title}>
          <Input id="title" name="title" defaultValue={initial?.title ?? ""} placeholder="1-апта" maxLength={80} invalid={!!fe.title} />
        </Field>
        <Field id="position" label="Реті" error={fe.position} hint="Үлкені — жаңасы">
          <Input id="position" name="position" type="number" min={1} max={1000} defaultValue={initial?.position ?? 1} invalid={!!fe.position} />
        </Field>
      </div>
      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 p-3.5 transition hover:border-brand-300">
        <input type="checkbox" name="is_published" defaultChecked={initial?.is_published ?? true} className="size-5 accent-brand-500" />
        <span className="text-sm font-medium text-slate-800">Оқушыларға рейтингті көрсету</span>
      </label>
      <SubmitButton pendingText="Сақталуда...">{submitLabel}</SubmitButton>
    </form>
  );
}
