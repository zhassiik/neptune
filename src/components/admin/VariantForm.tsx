"use client";

import { useActionState, useState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import type { FormState } from "@/lib/admin/actions";
import type { TestVariant } from "@/lib/types";

export interface CourseOption {
  id: string;
  title: string;
}

export function VariantForm({
  action,
  initial,
  submitLabel,
  courses,
  nextPositions = {},
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: Partial<TestVariant>;
  submitLabel: string;
  courses: CourseOption[];
  /** Жаңа нұсқа үшін: әр курстағы келесі бос нөмір */
  nextPositions?: Record<string, number>;
}) {
  const [state, formAction] = useActionState(action, {});
  const fe = state.fieldErrors ?? {};
  const [courseId, setCourseId] = useState(initial?.course_id ?? courses[0]?.id ?? "");
  const [position, setPosition] = useState(String(initial?.position ?? nextPositions[courseId] ?? 1));
  const [positionTouched, setPositionTouched] = useState(!!initial?.position);
  const [provider, setProvider] = useState<"url" | "cloudflare">(
    initial?.video_provider ?? (initial?.video_url ? "url" : "cloudflare"),
  );

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      <div className="grid gap-5 sm:grid-cols-[1fr_140px]">
        <Field id="course_id" label="Курс *" error={fe.course_id}>
          <Select
            id="course_id"
            name="course_id"
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              if (!positionTouched) setPosition(String(nextPositions[e.target.value] ?? 1));
            }}
            invalid={!!fe.course_id}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="position" label="Нұсқа нөмірі *" error={fe.position}>
          <Input
            id="position"
            name="position"
            type="number"
            min={1}
            max={1000}
            inputMode="numeric"
            value={position}
            onChange={(e) => {
              setPosition(e.target.value);
              setPositionTouched(true);
            }}
            invalid={!!fe.position}
          />
        </Field>
      </div>

      <Field id="title" label="Нұсқа атауы *" error={fe.title} hint={`Оқушыға «НҰСҚА ${position || "N"}. ${"<атауы>"}» болып көрінеді. Мысалы: Контекст Қарағай ағашы`}>
        <Input id="title" name="title" defaultValue={initial?.title ?? ""} placeholder="Контекст Қарағай ағашы" invalid={!!fe.title} required maxLength={150} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="subject" label="Пән *" error={fe.subject}>
          <Input id="subject" name="subject" defaultValue={initial?.subject ?? "Математика"} invalid={!!fe.subject} required maxLength={80} />
        </Field>
        <Field id="time_limit_minutes" label="Уақыт шектеуі (минут)" error={fe.time_limit_minutes} hint="Бос қалдырсаңыз — шектеусіз">
          <Input
            id="time_limit_minutes"
            name="time_limit_minutes"
            type="number"
            min={1}
            max={600}
            inputMode="numeric"
            defaultValue={initial?.time_limit_minutes ?? ""}
            placeholder="Мысалы: 80"
            invalid={!!fe.time_limit_minutes}
          />
        </Field>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        <h3 className="font-semibold text-navy-900">Видео-талдау (ТАЛДАУ №{position || "N"})</h3>
        <p className="mt-0.5 mb-4 text-sm text-slate-500">Бос қалдырсаңыз — оқушыға тек тест көрінеді.</p>

        <input type="hidden" name="video_provider" value={provider} />
        <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Видео көзі">
          {(
            [
              ["cloudflare", "Cloudflare Stream (қорғалған)"],
              ["url", "Сілтеме (YouTube, Vimeo…)"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={provider === key}
              onClick={() => setProvider(key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${provider === key ? "bg-white text-navy-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          {/* Екі өріс те формада қалады: көзді ауыстырғанда бұрынғы мән жоғалмайды */}
          <div className={provider === "cloudflare" ? "" : "hidden"}>
            <Field
              id="cloudflare_video_uid"
              label="Cloudflare Video UID"
              error={fe.cloudflare_video_uid}
              hint="Cloudflare Stream → видео → Video ID (32 таңба). Cloudflare сілтемесін қойсаңыз да, UID өзі алынады."
            >
              <Input
                id="cloudflare_video_uid"
                name="cloudflare_video_uid"
                defaultValue={initial?.cloudflare_video_uid ?? ""}
                placeholder="ea95132c15732412d22c1476fa83f27a"
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-sm"
                invalid={!!fe.cloudflare_video_uid}
              />
            </Field>
          </div>
          <div className={provider === "url" ? "" : "hidden"}>
            <Field id="video_url" label="Видео сілтемесі" error={fe.video_url} hint="YouTube (unlisted), Vimeo, Kinescope немесе .mp4">
              <Input id="video_url" name="video_url" type="url" defaultValue={initial?.video_url ?? ""} placeholder="https://youtu.be/..." invalid={!!fe.video_url} />
            </Field>
          </div>
          <Field
            id="video_duration_minutes"
            label="Ұзақтығы (минут)"
            error={fe.video_duration_minutes}
            hint={provider === "cloudflare" ? "Бос болса — Cloudflare-дан автоматты алынады" : "101 → 1 сағ 41 мин"}
          >
            <Input
              id="video_duration_minutes"
              name="video_duration_minutes"
              type="number"
              min={1}
              max={600}
              inputMode="numeric"
              defaultValue={initial?.video_duration_minutes ?? ""}
              placeholder="101"
              invalid={!!fe.video_duration_minutes}
            />
          </Field>
        </div>
      </div>

      <Field id="description" label="Қысқа сипаттама" error={fe.description}>
        <Textarea id="description" name="description" defaultValue={initial?.description ?? ""} rows={2} maxLength={1000} placeholder="Міндетті емес" />
      </Field>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-brand-50/30">
        <input type="checkbox" name="show_correct_answers" defaultChecked={initial?.show_correct_answers ?? true} className="mt-0.5 size-5 accent-brand-500" />
        <span>
          <span className="block font-medium text-slate-800">Тест аяқталғаннан кейін дұрыс жауаптарды көрсету</span>
          <span className="text-sm text-slate-500">Өшірілсе, оқушы тек өз балын көреді (дұрыс жауаптар мен түсіндірмелер жасырылады).</span>
        </span>
      </label>
      <SubmitButton pendingText="Сақталуда...">{submitLabel}</SubmitButton>
    </form>
  );
}
