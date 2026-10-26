"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserMinus, Users } from "lucide-react";
import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import { grantCourseAccess, revokeCourseAccess, type FormState } from "@/lib/admin/actions";
import { formatDateTime } from "@/lib/utils";

export interface EnrollmentRow {
  student_id: string;
  created_at: string;
  full_name: string;
  email: string | null;
}

/** Курсқа рұқсат берілген оқушылар (access_mode = enrolled болғанда маңызды) */
export function EnrollmentManager({ courseId, accessMode, rows }: { courseId: string; accessMode: string; rows: EnrollmentRow[] }) {
  const [state, action] = useActionState<FormState, FormData>(grantCourseAccess.bind(null, courseId), {});
  const formRef = useRef<HTMLFormElement>(null);
  const [revoke, setRevoke] = useState<EnrollmentRow | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <section className="card mt-6 max-w-2xl p-6 sm:p-8">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Users className="size-5 text-brand-500" /> Рұқсат берілген оқушылар ({rows.length})
      </h2>
      {accessMode === "open" ? (
        <Alert tone="info" className="mt-3">
          Қазір курс <b>барлық тіркелген оқушыларға ашық</b>, сондықтан бұл тізім әсер етпейді. Ақылы курс етіп шектеу үшін жоғарыдағы «Кімге ашық» өрісін
          «Тек рұқсат берілген оқушыларға» деп ауыстырыңыз.
        </Alert>
      ) : (
        <p className="mt-1 text-sm text-slate-500">Тек осы тізімдегі оқушылар курстың нұсқаларын тапсырып, видео-талдауларын көре алады.</p>
      )}

      <form ref={formRef} action={action} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
        <Field id="enroll-email" error={state.fieldErrors?.email} className="flex-1">
          <Input id="enroll-email" name="email" type="email" placeholder="Оқушының email-і" invalid={!!state.fieldErrors?.email} aria-label="Оқушының email-і" />
        </Field>
        <SubmitButton pendingText="Қосылуда...">
          <UserPlus className="size-4" /> Рұқсат беру
        </SubmitButton>
      </form>
      {state.error && <Alert tone="error" className="mt-3">{state.error}</Alert>}
      {state.message && <Alert tone="success" className="mt-3">{state.message}</Alert>}

      {rows.length > 0 && (
        <ul className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-100">
          {rows.map((r) => (
            <li key={r.student_id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-navy-900">{r.full_name || "—"}</div>
                <div className="truncate text-sm text-slate-500">
                  {r.email} · {formatDateTime(r.created_at)}
                </div>
              </div>
              <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setRevoke(r)}>
                <UserMinus className="size-4" /> Алып тастау
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!revoke}
        onClose={() => setRevoke(null)}
        loading={pending}
        danger
        title="Рұқсатты алу керек пе?"
        confirmLabel="Иә, алу"
        onConfirm={() =>
          start(async () => {
            if (!revoke) return;
            const res = await revokeCourseAccess(courseId, revoke.student_id);
            if (res.error) toast(res.error, "error");
            else {
              toast(res.message ?? "Рұқсат алынды");
              setRevoke(null);
              router.refresh();
            }
          })
        }
      >
        <b className="text-navy-900">{revoke?.full_name || revoke?.email}</b> бұл курстың нұсқалары мен видеоларына кіре алмайды. Бұрынғы нәтижелері сақталады.
      </ConfirmDialog>
    </section>
  );
}
