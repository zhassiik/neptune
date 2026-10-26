"use client";

import { useActionState } from "react";
import { signUp, type AuthState } from "@/lib/actions/auth";
import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import { PasswordInput } from "./PasswordInput";

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(signUp, {});
  const fe = state.fieldErrors ?? {};

  if (state.message) {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {next && <input type="hidden" name="next" value={next} />}
      <Field id="full_name" label="Аты-жөні" error={fe.full_name}>
        <Input id="full_name" name="full_name" autoComplete="name" placeholder="Мысалы: Айгерім Сәрсенқызы" defaultValue={state.values?.full_name} invalid={!!fe.full_name} required />
      </Field>
      <Field id="email" label="Email" error={fe.email}>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="example@mail.kz" defaultValue={state.values?.email} invalid={!!fe.email} required />
      </Field>
      <Field id="password" label="Құпиясөз" error={fe.password} hint="Кемінде 8 таңба">
        <PasswordInput id="password" name="password" autoComplete="new-password" invalid={!!fe.password} required />
      </Field>
      <Field id="password_confirm" label="Құпиясөзді қайталаңыз" error={fe.password_confirm}>
        <PasswordInput id="password_confirm" name="password_confirm" autoComplete="new-password" invalid={!!fe.password_confirm} required />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Тіркелуде...">
        Тіркелу
      </SubmitButton>
    </form>
  );
}
