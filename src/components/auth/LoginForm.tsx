"use client";

import { useActionState } from "react";
import { signIn, type AuthState } from "@/lib/actions/auth";
import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import { PasswordInput } from "./PasswordInput";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(signIn, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      {notice && !state.error && <Alert tone="warning">{notice}</Alert>}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {next && <input type="hidden" name="next" value={next} />}
      <Field id="email" label="Email" error={fe.email}>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="example@mail.kz" defaultValue={state.values?.email} invalid={!!fe.email} required />
      </Field>
      <Field id="password" label="Құпиясөз" error={fe.password}>
        <PasswordInput id="password" name="password" autoComplete="current-password" placeholder="••••••••" invalid={!!fe.password} required />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Кіруде...">
        Кіру
      </SubmitButton>
    </form>
  );
}
