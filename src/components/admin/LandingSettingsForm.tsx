"use client";

import { useActionState } from "react";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import { updateLandingSettings, type FormState } from "@/lib/admin/actions";
import type { PlatformSettings } from "@/lib/types";
import { toAlmatyInput } from "@/lib/utils";

export function LandingSettingsForm({ initial }: { initial: PlatformSettings }) {
  const [state, action] = useActionState<FormState, FormData>(updateLandingSettings, {});
  const fe = state.fieldErrors ?? {};
  const stats = [0, 1, 2].map((i) => initial.landing_stats[i] ?? { value: "", label: "" });

  return (
    <form action={action} className="space-y-6" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      <fieldset className="space-y-4">
        <legend className="mb-1 font-semibold text-navy-900">Апай туралы блок</legend>
        <Field id="teacher_name" label="Аты-жөні" error={fe.teacher_name}>
          <Input id="teacher_name" name="teacher_name" defaultValue={initial.teacher_name} invalid={!!fe.teacher_name} maxLength={80} />
        </Field>
        <Field id="teacher_bio" label="Өзі туралы" error={fe.teacher_bio} hint="Әр жол — бір пункт (мысалы: Abai university)">
          <Textarea id="teacher_bio" name="teacher_bio" defaultValue={initial.teacher_bio} rows={5} maxLength={1000} invalid={!!fe.teacher_bio} />
        </Field>
      </fieldset>

      <fieldset>
        <legend className="mb-1 font-semibold text-navy-900">Көрсеткіштер (Hero астында)</legend>
        <p className="mb-3 text-sm text-slate-500">Мысалы: «78+» — «оқушы 2026 ҰБТ-да 40+ балл жинады». Бірінші көрсеткіш фотоның жанында да шығады.</p>
        <div className="space-y-2">
          {stats.map((s, i) => (
            <div key={i}>
              <div className="grid grid-cols-[110px_1fr] gap-2">
                <Input name={`stat_value_${i}`} defaultValue={s.value} placeholder="78+" maxLength={12} aria-label={`${i + 1}-көрсеткіш мәні`} />
                <Input name={`stat_label_${i}`} defaultValue={s.label} placeholder="оқушы 2026 ҰБТ-да 40+ балл жинады" maxLength={80} aria-label={`${i + 1}-көрсеткіш сипаттамасы`} />
              </div>
              {fe[`stat_${i}`] && <p className="field-error">{fe[`stat_${i}`]}</p>}
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 font-semibold text-navy-900">«Курсқа қосылу» батырмасы</legend>
        <Field
          id="join_url"
          label="Батырма сілтемесі (WhatsApp)"
          error={fe.join_url}
          hint="Мысалы: https://wa.me/77471401404 немесе WhatsApp-тағы «Сілтеме арқылы чатқа шақыру». Бос болса — төмендегі WhatsApp нөміріне, ол да бос болса — курс бетіне апарады"
        >
          <Input id="join_url" name="join_url" type="url" defaultValue={initial.join_url ?? ""} placeholder="https://wa.me/7747..." invalid={!!fe.join_url} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-[1fr_220px]">
        <legend className="mb-1 font-semibold text-navy-900">ҰБТ кері санағы</legend>
        <Field id="exam_countdown_title" label="Мәтін" error={fe.exam_countdown_title}>
          <Input id="exam_countdown_title" name="exam_countdown_title" defaultValue={initial.exam_countdown_title} maxLength={120} invalid={!!fe.exam_countdown_title} />
        </Field>
        <Field id="exam_date" label="Күні мен уақыты (Алматы)" error={fe.exam_date} hint="Бос болса — блок көрсетілмейді">
          <Input id="exam_date" name="exam_date" type="datetime-local" defaultValue={toAlmatyInput(initial.exam_date)} invalid={!!fe.exam_date} />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 font-semibold text-navy-900">Әлеуметтік желілер (footer)</legend>
        <Field id="instagram_url" label="Instagram" error={fe.instagram_url}>
          <Input id="instagram_url" name="instagram_url" type="url" defaultValue={initial.instagram_url ?? ""} placeholder="https://www.instagram.com/zhazira_turgumbay/" invalid={!!fe.instagram_url} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="telegram_url" label="Telegram" error={fe.telegram_url}>
            <Input id="telegram_url" name="telegram_url" type="url" defaultValue={initial.telegram_url ?? ""} placeholder="https://t.me/..." invalid={!!fe.telegram_url} />
          </Field>
          <Field id="whatsapp_phone" label="WhatsApp нөмірі" error={fe.whatsapp_phone}>
            <Input id="whatsapp_phone" name="whatsapp_phone" type="tel" defaultValue={initial.whatsapp_phone ?? ""} placeholder="+7 747 000 00 00" invalid={!!fe.whatsapp_phone} />
          </Field>
        </div>
      </fieldset>

      <SubmitButton pendingText="Сақталуда...">Басты бетті сақтау</SubmitButton>
    </form>
  );
}
