"use client";

import Image from "next/image";
import { useActionState, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { createClient } from "@/lib/supabase/client";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_MB, optimizeImage, validateImageFile } from "@/lib/admin/image";
import { humanizeError, uuid } from "@/lib/utils";
import type { FormState } from "@/lib/admin/actions";
import type { Course } from "@/lib/types";

const STATUS_LABELS = {
  published: "Ашық — оқушылар кіре алады",
  coming_soon: "Жақында — карточка көрінеді, бірақ жабық",
  draft: "Жоба — оқушыларға мүлдем көрінбейді",
};

export function CourseForm({
  action,
  initial,
  initialCoverUrl,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: Partial<Course>;
  initialCoverUrl?: string | null;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const fe = state.fieldErrors ?? {};
  const inputRef = useRef<HTMLInputElement>(null);
  const [cover, setCover] = useState<{ path: string; url: string | null }>({ path: initial?.cover_path ?? "", url: initialCoverUrl ?? null });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    const invalid = validateImageFile(file);
    if (invalid) return setUploadError(invalid);
    setUploading(true);
    try {
      const optimized = await optimizeImage(file);
      const path = `covers/${uuid()}.${optimized.ext}`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("course-covers").upload(path, optimized.blob, { contentType: optimized.type, cacheControl: "31536000" });
      if (error) throw error;
      const { data } = supabase.storage.from("course-covers").getPublicUrl(path);
      setCover({ path, url: data.publicUrl });
    } catch (e) {
      setUploadError(`Жүктеу сәтсіз: ${humanizeError(e)}`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      <div>
        <span className="field-label">Мұқаба суреті</span>
        <input type="hidden" name="cover_path" value={cover.path} />
        <input ref={inputRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} className="sr-only" onChange={(e) => upload(e.target.files?.[0])} aria-label="Мұқаба таңдау" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="relative grid aspect-video w-full max-w-72 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-500 transition hover:border-brand-300 hover:bg-brand-50/40 active:scale-[0.99]"
          >
            {cover.url ? (
              <Image src={cover.url} alt="Мұқаба" fill sizes="288px" className="object-cover" unoptimized />
            ) : (
              <span className="flex flex-col items-center gap-1 text-sm">
                <ImagePlus className="size-6" /> Сурет таңдау
              </span>
            )}
            {uploading && (
              <span className="absolute inset-0 grid place-items-center bg-white/70">
                <Spinner className="size-6 text-brand-500" />
              </span>
            )}
          </button>
          <div className="text-sm text-slate-500">
            <p>16:9 пропорциясы ұсынылады (мысалы, 1280×720). JPG, PNG, WebP, макс. {MAX_UPLOAD_MB} МБ.</p>
            {cover.url && (
              <Button size="sm" variant="ghost" className="mt-2 -ml-3 text-red-600 hover:bg-red-50" onClick={() => setCover({ path: "", url: null })}>
                <Trash2 className="size-4" /> Мұқабаны алып тастау
              </Button>
            )}
          </div>
        </div>
        {uploadError && <p className="field-error">{uploadError}</p>}
        {fe.cover_path && <p className="field-error">{fe.cover_path}</p>}
      </div>

      <Field id="title" label="Курс атауы *" error={fe.title}>
        <Input id="title" name="title" defaultValue={initial?.title ?? ""} placeholder="ТАҢҒЫ 200 НҰСҚА ТАЛДАУ" invalid={!!fe.title} maxLength={150} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="slug" label="Сілтеме (slug) *" error={fe.slug} hint="Сайттағы адрес: /courses/<slug>">
          <Input id="slug" name="slug" defaultValue={initial?.slug ?? ""} placeholder="tangy-200" invalid={!!fe.slug} maxLength={80} />
        </Field>
        <Field id="price" label="Бағасы (₸)" error={fe.price} hint="Тек көрсету үшін. Бос — баға көрсетілмейді">
          <Input id="price" name="price" type="number" min={0} inputMode="numeric" defaultValue={initial?.price ?? ""} placeholder="200000" invalid={!!fe.price} />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-[1fr_140px]">
        <Field id="status" label="Күйі" error={fe.status}>
          <Select id="status" name="status" defaultValue={initial?.status ?? "draft"}>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="position" label="Реті" error={fe.position} hint="Басты бетте">
          <Input id="position" name="position" type="number" min={1} max={1000} defaultValue={initial?.position ?? 1} invalid={!!fe.position} />
        </Field>
      </div>
      <Field id="access_mode" label="Кімге ашық" error={fe.access_mode} hint="«Тек рұқсат берілгендерге» таңдасаңыз, курс бетіндегі тізімге оқушыларды email арқылы қосасыз">
        <Select id="access_mode" name="access_mode" defaultValue={initial?.access_mode ?? "open"}>
          <option value="open">Барлық тіркелген оқушыларға</option>
          <option value="enrolled">Тек рұқсат берілген оқушыларға (ақылы курс)</option>
        </Select>
      </Field>
      <Field id="description" label="Сипаттама" error={fe.description}>
        <Textarea id="description" name="description" defaultValue={initial?.description ?? ""} rows={3} maxLength={2000} />
      </Field>
      <SubmitButton pendingText="Сақталуда..." disabled={uploading}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
