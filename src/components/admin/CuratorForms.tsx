"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Pencil, UserMinus, UserPlus, X } from "lucide-react";
import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import { addCurator, cancelCuratorInvite, removeCurator, updateCuratorCourses } from "@/lib/admin/curator-actions";
import type { FormState } from "@/lib/admin/actions";

export interface CourseOption {
  id: string;
  title: string;
}

function CourseCheckboxes({ courses, selected }: { courses: CourseOption[]; selected?: string[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {courses.map((c) => (
        <li key={c.id}>
          <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm transition hover:border-brand-300">
            <input type="checkbox" name="course_id" value={c.id} defaultChecked={selected?.includes(c.id)} className="size-4 accent-brand-500" />
            <span className="min-w-0 truncate">{c.title}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

/** Жаңа куратор: gmail + курстар */
export function CuratorAddForm({ courses }: { courses: CourseOption[] }) {
  const [state, action] = useActionState<FormState, FormData>(addCurator, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <UserPlus className="size-5 text-brand-500" /> Куратор қосу
      </h2>
      <p className="text-sm text-slate-500">
        Куратордың gmail-ын жазып, қай курстың куратор екенін белгілеңіз. Ол сол курстардағы оқушылардың нәтижелерін көреді және черновик/конспектке белгі қояды.
        Видео жүктей алмайды, курсты өзгерте алмайды.
      </p>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <Field id="curator-email" label="Gmail" error={fe.email}>
        <Input id="curator-email" name="email" type="email" inputMode="email" autoComplete="off" placeholder="kurator@gmail.com" invalid={!!fe.email} />
      </Field>
      <div>
        <span className="field-label">Курстар</span>
        <CourseCheckboxes courses={courses} />
        {fe.courses && <p className="field-error">{fe.courses}</p>}
      </div>
      <SubmitButton size="sm">Куратор ету</SubmitButton>
    </form>
  );
}

function CuratorCoursesForm({ curatorId, courses, selected, onDone }: { curatorId: string; courses: CourseOption[]; selected: string[]; onDone: () => void }) {
  const [state, action] = useActionState<FormState, FormData>(updateCuratorCourses.bind(null, curatorId), {});
  return (
    <form action={action} className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <CourseCheckboxes courses={courses} selected={selected} />
      <div className="flex gap-2">
        <SubmitButton size="sm">Сақтау</SubmitButton>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Жабу
        </Button>
      </div>
    </form>
  );
}

function ConfirmAction({ label, title, children, onConfirm, icon }: { label: string; title: string; children: React.ReactNode; onConfirm: () => Promise<FormState>; icon: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setOpen(true)}>
        {icon} {label}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        loading={pending}
        danger
        title={title}
        confirmLabel="Иә"
        onConfirm={() =>
          start(async () => {
            const r = await onConfirm();
            if (r.error) toast(r.error, "error");
            else {
              toast(r.message ?? "Сақталды");
              setOpen(false);
              router.refresh();
            }
          })
        }
      >
        {children}
      </ConfirmDialog>
    </>
  );
}

export function CuratorRow({
  curator,
  courses,
}: {
  curator: { id: string; name: string; email: string | null; courseIds: string[] };
  courses: CourseOption[];
}) {
  const [editing, setEditing] = useState(false);
  const titles = new Map(courses.map((c) => [c.id, c.title]));
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-navy-900">{curator.name}</div>
          <div className="text-sm text-slate-500">{curator.email}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {curator.courseIds.length ? curator.courseIds.map((id) => <Badge key={id} tone="blue">{titles.get(id) ?? "Курс"}</Badge>) : <Badge tone="amber">Курс бекітілмеген</Badge>}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
          <Pencil className="size-4" /> Курстары
        </Button>
        <ConfirmAction label="Куратор емес" title="Куратор құқығын алу керек пе?" onConfirm={() => removeCurator(curator.id)} icon={<UserMinus className="size-4" />}>
          <b className="text-navy-900">{curator.name}</b> қайтадан қарапайым оқушы болады және оқушылардың нәтижелерін көре алмайды.
        </ConfirmAction>
      </div>
      {editing && <CuratorCoursesForm curatorId={curator.id} courses={courses} selected={curator.courseIds} onDone={() => setEditing(false)} />}
    </li>
  );
}

export function InviteRow({ invite, courses }: { invite: { email: string; courseIds: string[] }; courses: CourseOption[] }) {
  const titles = new Map(courses.map((c) => [c.id, c.title]));
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-4">
      <span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600">
        <Clock className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-navy-900">{invite.email}</div>
        <div className="text-xs text-slate-500">Әлі тіркелмеген — осы gmail-мен тіркелгенде куратор болады</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {invite.courseIds.map((id) => (
            <Badge key={id}>{titles.get(id) ?? "Курс"}</Badge>
          ))}
        </div>
      </div>
      <ConfirmAction label="Алып тастау" title="Шақыруды алып тастау керек пе?" onConfirm={() => cancelCuratorInvite(invite.email)} icon={<X className="size-4" />}>
        <b className="text-navy-900">{invite.email}</b> тіркелсе, қарапайым оқушы болады.
      </ConfirmAction>
    </li>
  );
}
