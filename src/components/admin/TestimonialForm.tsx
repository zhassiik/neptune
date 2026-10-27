"use client";

import Image from "next/image";
import { useActionState, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { createClient } from "@/lib/supabase/client";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_MB, optimizeImage, validateImageFile } from "@/lib/admin/image";
import { humanizeError, uuid } from "@/lib/utils";
import type { FormState } from "@/lib/admin/actions";
import type { Testimonial } from "@/lib/types";

export function TestimonialForm({
  action,
  initial,
  initialPhotoUrl,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: Partial<Testimonial>;
  initialPhotoUrl?: string | null;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const fe = state.fieldErrors ?? {};
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState({ path: initial?.photo_path ?? "", url: initialPhotoUrl ?? null });
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
      const path = `testimonials/${uuid()}.${optimized.ext}`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("site-media").upload(path, optimized.blob, { contentType: optimized.type, cacheControl: "31536000" });
      if (error) throw error;
      setPhoto({ path, url: supabase.storage.from("site-media").getPublicUrl(path).data.publicUrl });
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
        <span className="field-label">Оқушының фотосы</span>
        <input type="hidden" name="photo_path" value={photo.path} />
        <input ref={inputRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} className="sr-only" onChange={(e) => upload(e.target.files?.[0])} aria-label="Фото таңдау" />
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="relative grid size-28 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 transition hover:border-brand-300 active:scale-95"
          >
            {photo.url ? <Image src={photo.url} alt="Фото" fill sizes="112px" className="object-cover" unoptimized /> : <ImagePlus className="size-7" />}
            {uploading && (
              <span className="absolute inset-0 grid place-items-center bg-white/70">
                <Spinner className="size-6 text-brand-500" />
              </span>
            )}
          </button>
          <div className="text-sm text-slate-500">
            <p>Шаршы фото ұсынылады. JPG, PNG, WebP, макс. {MAX_UPLOAD_MB} МБ.</p>
            {photo.url && (
              <Button size="sm" variant="ghost" className="mt-1 -ml-3 text-red-600 hover:bg-red-50" onClick={() => setPhoto({ path: "", url: null })}>
                <Trash2 className="size-4" /> Фотоны алып тастау
              </Button>
            )}
          </div>
        </div>
        {uploadError && <p className="field-error">{uploadError}</p>}
        {fe.photo_path && <p className="field-error">{fe.photo_path}</p>}
      </div>

      <div className="grid gap-5 sm:grid-cols-[1fr_140px]">
        <Field id="student_name" label="Оқушының аты-жөні *" error={fe.student_name}>
          <Input id="student_name" name="student_name" defaultValue={initial?.student_name ?? ""} placeholder="Төлеген Данияр" maxLength={80} invalid={!!fe.student_name} />
        </Field>
        <Field id="score" label="ҰБТ балы" error={fe.score}>
          <Input id="score" name="score" type="number" min={0} max={140} defaultValue={initial?.score ?? ""} placeholder="128" invalid={!!fe.score} />
        </Field>
      </div>
      <Field id="score_label" label="Балл жазуы (міндетті емес)" error={fe.score_label} hint="Бос болса — «128 балл». Мысалы: «Математика: 45/50»">
        <Input id="score_label" name="score_label" defaultValue={initial?.score_label ?? ""} maxLength={40} />
      </Field>
      <Field id="text" label="Пікір мәтіні *" error={fe.text}>
        <Textarea id="text" name="text" defaultValue={initial?.text ?? ""} rows={7} maxLength={3000} invalid={!!fe.text} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-[1fr_140px]">
        <Field id="video_url" label="Видео-пікір сілтемесі" error={fe.video_url} hint="YouTube, Vimeo, Kinescope, .mp4 немесе Instagram">
          <Input id="video_url" name="video_url" type="url" defaultValue={initial?.video_url ?? ""} placeholder="https://youtu.be/..." invalid={!!fe.video_url} />
        </Field>
        <Field id="position" label="Реті" error={fe.position}>
          <Input id="position" name="position" type="number" min={1} max={1000} defaultValue={initial?.position ?? 1} invalid={!!fe.position} />
        </Field>
      </div>
      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-brand-300">
        <input type="checkbox" name="is_published" defaultChecked={initial?.is_published ?? true} className="size-5 accent-brand-500" />
        <span className="font-medium text-slate-800">Басты бетте көрсету</span>
      </label>
      <SubmitButton pendingText="Сақталуда..." disabled={uploading}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
