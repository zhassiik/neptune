"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import { updateProfile, type ProfileFormState } from "@/lib/actions/profile";

export function ProfileForm({
  profile,
  email,
  required,
  complete,
  next,
}: {
  profile: { full_name: string; phone: string; parent_phone: string };
  email: string;
  /** Оқушы үшін телефондар міндетті */
  required: boolean;
  /** Алғаш толтыру режимі: сақтаған соң next бетіне өтеді */
  complete: boolean;
  next?: string;
}) {
  const [state, action] = useActionState<ProfileFormState, FormData>(updateProfile, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      {complete && <input type="hidden" name="complete" value="1" />}
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      <Field id="full_name" label="Аты-жөні" error={fe.full_name}>
        <Input id="full_name" name="full_name" autoComplete="name" defaultValue={profile.full_name} invalid={!!fe.full_name} required />
      </Field>

      <Field id="email" label="Email" hint="Email-ді өзгерту мүмкін емес — ол аккаунтқа кіру үшін қолданылады">
        <div className="relative">
          <Input id="email" value={email} disabled readOnly className="pr-10" />
          <Lock className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        </div>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="phone" label={required ? "Телефон нөміріңіз" : "Телефон нөміріңіз (міндетті емес)"} error={fe.phone}>
          <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 700 123 45 67" defaultValue={profile.phone} invalid={!!fe.phone} required={required} />
        </Field>
        <Field id="parent_phone" label={required ? "Ата-анаңыздың нөмірі" : "Ата-ананың нөмірі (міндетті емес)"} error={fe.parent_phone}>
          <Input id="parent_phone" name="parent_phone" type="tel" inputMode="tel" placeholder="+7 701 765 43 21" defaultValue={profile.parent_phone} invalid={!!fe.parent_phone} required={required} />
        </Field>
      </div>

      <SubmitButton size="lg" className="w-full sm:w-auto" pendingText="Сақталуда...">
        {complete ? "Сақтап, жалғастыру" : "Сақтау"}
      </SubmitButton>
    </form>
  );
}
