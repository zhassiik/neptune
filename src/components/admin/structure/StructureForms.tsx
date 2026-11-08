"use client";

import Link from "next/link";
import { useActionState, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Eye, EyeOff, Pencil, PlayCircle, Plus, Trash2, Video } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { Planet } from "@/components/courses/Planet";
import { PLANET_KEYS, PLANETS, type PlanetKey } from "@/lib/planets";
import { createLesson, createModule, deleteLesson, deleteModule, ensureIntroLesson, updateLesson, updateModule } from "@/lib/admin/structure-actions";
import type { FormState } from "@/lib/admin/actions";
import { cn } from "@/lib/utils";

export interface StructureModule {
  id: string;
  title: string;
  planet: PlanetKey;
  position: number;
  is_published: boolean;
}

export interface StructureLesson {
  id: string;
  module_id: string | null;
  kind: "intro" | "video" | "test";
  title: string;
  position: number;
  is_published: boolean;
  variant_id: string | null;
  duration_minutes: number | null;
  hasVideo: boolean;
  test?: { status: "draft" | "published"; questions: number } | null;
}

function FormMessages({ state }: { state: FormState }) {
  return (
    <>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
    </>
  );
}

function PlanetSelect({ value, onChange, error }: { value: PlanetKey; onChange: (p: PlanetKey) => void; error?: string }) {
  return (
    <Field id="planet" label="Ғаламшар" error={error}>
      <div className="flex items-center gap-3">
        <Planet planet={value} className="w-12" />
        <Select id="planet" name="planet" value={value} onChange={(e) => onChange(e.target.value as PlanetKey)}>
          {PLANET_KEYS.map((k) => (
            <option key={k} value={k}>
              {PLANETS[k].name}
            </option>
          ))}
        </Select>
      </div>
    </Field>
  );
}

/** Жаңа блок */
export function ModuleCreateForm({ courseId, nextPlanet }: { courseId: string; nextPlanet: PlanetKey }) {
  const [state, action] = useActionState<FormState, FormData>(createModule.bind(null, courseId), {});
  const [planet, setPlanet] = useState<PlanetKey>(nextPlanet);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <h3 className="flex items-center gap-2 font-bold text-navy-900">
        <Plus className="size-5 text-brand-500" /> Жаңа блок
      </h3>
      <FormMessages state={state} />
      <div className="grid gap-4 sm:grid-cols-[1fr_260px]">
        <Field id="new-module-title" label="Блоктың атауы" error={fe.title}>
          <Input id="new-module-title" name="title" placeholder="Мысалы: Алгебралық өрнектер" maxLength={120} invalid={!!fe.title} />
        </Field>
        <PlanetSelect value={planet} onChange={setPlanet} error={fe.planet} />
      </div>
      <SubmitButton size="sm">Блок қосу</SubmitButton>
    </form>
  );
}

/** Курсқа кіріспе видео сабағын құру */
export function IntroCreateButton({ courseId }: { courseId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <Button
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await ensureIntroLesson(courseId);
          if (r.error) toast(r.error, "error");
          else router.refresh();
        })
      }
    >
      <Video className="size-4" /> Кіріспе видео қосу
    </Button>
  );
}

function DeleteButton({ label, title, children, onDelete }: { label: string; title: string; children: ReactNode; onDelete: () => Promise<FormState> }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 active:scale-90" aria-label={label}>
        <Trash2 className="size-4" />
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        loading={pending}
        danger
        title={title}
        confirmLabel="Иә, өшіру"
        onConfirm={() =>
          start(async () => {
            const r = await onDelete();
            if (r.error) toast(r.error, "error");
            else {
              toast(r.message ?? "Өшірілді");
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

function LessonEditForm({ lesson, onDone }: { lesson: StructureLesson; onDone: () => void }) {
  const [state, action] = useActionState<FormState, FormData>(updateLesson.bind(null, lesson.id), {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
      <FormMessages state={state} />
      <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
        <Field id={`lt-${lesson.id}`} label="Атауы" error={fe.title}>
          <Input id={`lt-${lesson.id}`} name="title" defaultValue={lesson.title} maxLength={150} invalid={!!fe.title} />
        </Field>
        <Field id={`lp-${lesson.id}`} label="Реті" error={fe.position}>
          <Input id={`lp-${lesson.id}`} name="position" type="number" min={1} max={1000} defaultValue={lesson.position} invalid={!!fe.position} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="is_published" defaultChecked={lesson.is_published} className="size-4 accent-brand-500" /> Оқушыларға көрсету
      </label>
      <div className="flex gap-2">
        <SubmitButton size="sm">Сақтау</SubmitButton>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Жабу
        </Button>
      </div>
    </form>
  );
}

function LessonRow({ lesson, videoPanel }: { lesson: StructureLesson; videoPanel?: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const isTest = lesson.kind === "test";
  return (
    <li className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", isTest ? "bg-brand-50 text-brand-600" : "bg-navy-800 text-white")}>
          {isTest ? <ClipboardList className="size-5" /> : <PlayCircle className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-navy-900">
            {lesson.position}. {lesson.title}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs">
            {isTest ? (
              <>
                <Badge tone={lesson.test?.status === "published" ? "green" : "amber"}>{lesson.test?.status === "published" ? "Жарияланған" : "Draft"}</Badge>
                <Badge>{lesson.test?.questions ?? 0} сұрақ</Badge>
              </>
            ) : (
              <Badge tone={lesson.hasVideo ? "green" : "amber"}>{lesson.hasVideo ? `Видео бар${lesson.duration_minutes ? ` · ${lesson.duration_minutes} мин` : ""}` : "Видео жүктелмеген"}</Badge>
            )}
            {!lesson.is_published && (
              <Badge>
                <EyeOff className="size-3" /> Жасырын
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isTest ? (
            <Link href={`/admin/variants/${lesson.variant_id}`} className={buttonClasses({ size: "sm", variant: "secondary" })}>
              Сұрақтар
            </Link>
          ) : (
            <Button size="sm" variant={videoOpen ? "secondary" : "outline"} onClick={() => setVideoOpen((v) => !v)}>
              <Video className="size-4" /> Видео
            </Button>
          )}
          <button type="button" onClick={() => setEditing((v) => !v)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Сабақты өзгерту">
            <Pencil className="size-4" />
          </button>
          <DeleteButton label="Сабақты өшіру" title="Сабақты өшіру керек пе?" onDelete={() => deleteLesson(lesson.id)}>
            <b className="text-navy-900">«{lesson.title}»</b> {isTest ? "тесті, оның сұрақтары мен оқушылардың нәтижелері" : "сабағы және оның видеосы"} біржола өшіріледі.
          </DeleteButton>
        </div>
      </div>
      {editing && <LessonEditForm lesson={lesson} onDone={() => setEditing(false)} />}
      {!isTest && videoOpen && <div className="mt-3">{videoPanel}</div>}
    </li>
  );
}

function LessonCreateForm({ moduleId }: { moduleId: string }) {
  const [state, action] = useActionState<FormState, FormData>(createLesson.bind(null, moduleId), {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="mt-4 rounded-2xl border border-dashed border-slate-200 p-3 sm:p-4">
      <FormMessages state={state} />
      <div className="mt-1 grid gap-3 sm:grid-cols-[150px_1fr_auto] sm:items-end">
        <Field id={`k-${moduleId}`} label="Түрі">
          <Select id={`k-${moduleId}`} name="kind" defaultValue="video">
            <option value="video">Видео сабақ</option>
            <option value="test">Тест</option>
          </Select>
        </Field>
        <Field id={`t-${moduleId}`} label="Атауы" error={fe.title}>
          <Input id={`t-${moduleId}`} name="title" placeholder="Мысалы: Практикалық сабақ" maxLength={150} invalid={!!fe.title} />
        </Field>
        <SubmitButton size="md">
          <Plus className="size-4" /> Қосу
        </SubmitButton>
      </div>
    </form>
  );
}

function ModuleEditForm({ module, onDone }: { module: StructureModule; onDone: () => void }) {
  const [state, action] = useActionState<FormState, FormData>(updateModule.bind(null, module.id), {});
  const [planet, setPlanet] = useState<PlanetKey>(module.planet);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="mt-4 space-y-4 rounded-2xl bg-slate-50 p-4">
      <FormMessages state={state} />
      <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
        <Field id={`mt-${module.id}`} label="Блоктың атауы" error={fe.title}>
          <Input id={`mt-${module.id}`} name="title" defaultValue={module.title} maxLength={120} invalid={!!fe.title} />
        </Field>
        <Field id={`mp-${module.id}`} label="Реті" error={fe.position}>
          <Input id={`mp-${module.id}`} name="position" type="number" min={1} max={1000} defaultValue={module.position} invalid={!!fe.position} />
        </Field>
      </div>
      <PlanetSelect value={planet} onChange={setPlanet} error={fe.planet} />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="is_published" defaultChecked={module.is_published} className="size-4 accent-brand-500" /> Оқушыларға көрсету
      </label>
      <div className="flex gap-2">
        <SubmitButton size="sm">Сақтау</SubmitButton>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Жабу
        </Button>
      </div>
    </form>
  );
}

/** Бір блок: ғаламшары, атауы, сабақтары */
export function ModuleCard({ module, lessons, videoPanels }: { module: StructureModule; lessons: StructureLesson[]; videoPanels: Record<string, ReactNode> }) {
  const [editing, setEditing] = useState(false);
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-4">
        <Planet planet={module.planet} className="w-16" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold tracking-wide text-brand-600 uppercase">{PLANETS[module.planet].name}</div>
          <h3 className="truncate text-lg font-extrabold text-navy-900">
            №{module.position}. {module.title}
          </h3>
          <div className="text-sm text-slate-500">
            {lessons.length} сабақ
            {!module.is_published && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-700">
                <EyeOff className="size-3.5" /> жасырын
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
            {editing ? <Eye className="size-4" /> : <Pencil className="size-4" />} {editing ? "Жабу" : "Өзгерту"}
          </Button>
          <DeleteButton label="Блокты өшіру" title="Блокты өшіру керек пе?" onDelete={() => deleteModule(module.id)}>
            <b className="text-navy-900">«{module.title}»</b> блогы, оның барлық сабақтары, видеолары және тесттері (оқушылардың нәтижелерімен) біржола өшіріледі.
          </DeleteButton>
        </div>
      </div>
      {editing && <ModuleEditForm module={module} onDone={() => setEditing(false)} />}
      {lessons.length > 0 && (
        <ol className="mt-5 space-y-2">
          {lessons.map((l) => (
            <LessonRow key={l.id} lesson={l} videoPanel={videoPanels[l.id]} />
          ))}
        </ol>
      )}
      <LessonCreateForm moduleId={module.id} />
    </section>
  );
}
