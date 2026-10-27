"use client";

import { useActionState } from "react";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { changePassword, updateOwnProfile, updatePlatformSettings, type FormState } from "@/lib/admin/actions";
import type { PlatformSettings } from "@/lib/types";

function Status({ state }: { state: FormState }) {
  if (state.error) return <Alert tone="error">{state.error}</Alert>;
  if (state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

export function PlatformSettingsForm({ initial, deviceLimit }: { initial: PlatformSettings; deviceLimit: { limit: number; fromEnv: boolean } }) {
  const [state, action] = useActionState(updatePlatformSettings, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <Status state={state} />
      <Field id="platform_name" label="Платформа атауы" error={fe.platform_name}>
        <Input id="platform_name" name="platform_name" defaultValue={initial.platform_name} invalid={!!fe.platform_name} maxLength={80} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="contact_email" label="Байланыс email" error={fe.contact_email}>
          <Input id="contact_email" name="contact_email" type="email" defaultValue={initial.contact_email ?? ""} invalid={!!fe.contact_email} />
        </Field>
        <Field id="contact_phone" label="Телефон" error={fe.contact_phone}>
          <Input id="contact_phone" name="contact_phone" type="tel" defaultValue={initial.contact_phone ?? ""} invalid={!!fe.contact_phone} />
        </Field>
      </div>
      <Field id="contact_address" label="Мекенжай" error={fe.contact_address} hint="Бірнеше жолға жазуға болады">
        <Textarea id="contact_address" name="contact_address" defaultValue={initial.contact_address ?? ""} rows={3} maxLength={200} invalid={!!fe.contact_address} />
      </Field>
      <Field
        id="max_devices_per_user"
        label="Бір аккаунтқа рұқсат етілген құрылғы саны"
        error={fe.max_devices_per_user}
        hint={deviceLimit.fromEnv ? `Қазір MAX_DEVICES_PER_USER env айнымалысы қолданылады (${deviceLimit.limit}) — бұл мән оны басып оза алмайды` : "1–20. Әкімшілерге лимит қолданылмайды"}
      >
        <Input id="max_devices_per_user" name="max_devices_per_user" type="number" min={1} max={20} defaultValue={deviceLimit.fromEnv ? 4 : deviceLimit.limit} invalid={!!fe.max_devices_per_user} className="w-32" />
      </Field>
      <SubmitButton pendingText="Сақталуда...">Сақтау</SubmitButton>
    </form>
  );
}

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, action] = useActionState(updateOwnProfile, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <Status state={state} />
      <Field id="email_ro" label="Email">
        <Input id="email_ro" value={email} disabled readOnly />
      </Field>
      <Field id="full_name" label="Аты-жөні" error={state.fieldErrors?.full_name}>
        <Input id="full_name" name="full_name" defaultValue={fullName} invalid={!!state.fieldErrors?.full_name} />
      </Field>
      <SubmitButton pendingText="Сақталуда...">Профильді сақтау</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <Status state={state} />
      <Field id="password" label="Жаңа құпиясөз" error={fe.password} hint="Кемінде 8 таңба">
        <PasswordInput id="password" name="password" autoComplete="new-password" invalid={!!fe.password} />
      </Field>
      <Field id="password_confirm" label="Құпиясөзді қайталаңыз" error={fe.password_confirm}>
        <PasswordInput id="password_confirm" name="password_confirm" autoComplete="new-password" invalid={!!fe.password_confirm} />
      </Field>
      <SubmitButton variant="outline" pendingText="Өзгертілуде...">
        Құпиясөзді өзгерту
      </SubmitButton>
    </form>
  );
}
