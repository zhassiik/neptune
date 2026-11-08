"use client";

import Image from "next/image";
import { useActionState, useRef, useState } from "react";
import { Award, ImagePlus, Trash2 } from "lucide-react";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { createClient } from "@/lib/supabase/client";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_MB, optimizeImage, validateImageFile } from "@/lib/admin/image";
import { cn, humanizeError, uuid } from "@/lib/utils";
import type { FormState } from "@/lib/admin/actions";
import type { Graduate } from "@/lib/types";

type Picked = { path: string; url: string | null };

/** Бір суретті site-media/graduates/ ішіне жүктеу (фото немесе сертификат) */
function ImageUpload({
  name,
  label,
  hint,
  value,
  onChange,
  onBusy,
  shape,
  error,
}: {
  name: string;
  label: string;
  hint: string;
  value: Picked;
  onChange: (v: Picked) => void;
  onBusy: (busy: boolean) => void;
  shape: "portrait" | "certificate";
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    const invalid = validateImageFile(file);
    if (invalid) return setUploadError(invalid);
    setUploading(true);
    onBusy(true);
    try {
      const optimized = await optimizeImage(file);
      const path = `graduates/${uuid()}.${optimized.ext}`;
      const supabase = createClient();
      const { error: e } = await supabase.storage.from("site-media").upload(path, optimized.blob, { contentType: optimized.type, cacheControl: "31536000" });
      if (e) throw e;
      onChange({ path, url: supabase.storage.from("site-media").getPublicUrl(path).data.publicUrl });
    } catch (e) {
      setUploadError(`Жүктеу сәтсіз: ${humanizeError(e)}`);
    } finally {
      setUploading(false);
      onBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const Icon = shape === "portrait" ? ImagePlus : Award;
  return (
    <div>
      <span className="field-label">{label}</span>
      <input type="hidden" name={name} value={value.path} />
      <input ref={inputRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} className="sr-only" onChange={(e) => upload(e.target.files?.[0])} aria-label={label} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative grid w-full place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 transition hover:border-brand-300 active:scale-[0.98]",
          shape === "portrait" ? "aspect-[4/5]" : "aspect-[4/3]",
        )}
      >
        {value.url ? (
          <Image src={value.url} alt={label} fill sizes="320px" className={shape === "portrait" ? "object-cover" : "object-contain"} unoptimized />
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-sm">
            <Icon className="size-7" /> Таңдау
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 grid place-items-center bg-white/70">
            <Spinner className="size-6 text-brand-500" />
          </span>
        )}
      </button>
      <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      {value.url && (
        <Button size="sm" variant="ghost" className="-ml-3 text-red-600 hover:bg-red-50" onClick={() => onChange({ path: "", url: null })}>
          <Trash2 className="size-4" /> Алып тастау
        </Button>
      )}
      {uploadError && <p className="field-error">{uploadError}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export function GraduateForm({
  action,
  initial,
  initialPhotoUrl,
  initialCertificateUrl,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial?: Partial<Graduate>;
  initialPhotoUrl?: string | null;
  initialCertificateUrl?: string | null;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const fe = state.fieldErrors ?? {};
  const [photo, setPhoto] = useState<Picked>({ path: initial?.photo_path ?? "", url: initialPhotoUrl ?? null });
  const [certificate, setCertificate] = useState<Picked>({ path: initial?.certificate_path ?? "", url: initialCertificateUrl ?? null });
  const [busy, setBusy] = useState(0);
  const onBusy = (b: boolean) => setBusy((n) => n + (b ? 1 : -1));

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <ImageUpload
          name="photo_path"
          label="Түлектің фотосы"
          hint={`Тік (портрет) фото ұсынылады. JPG, PNG, WebP, макс. ${MAX_UPLOAD_MB} МБ.`}
          value={photo}
          onChange={setPhoto}
          onBusy={onBusy}
          shape="portrait"
          error={fe.photo_path}
        />
        <ImageUpload
          name="certificate_path"
          label="Сертификат"
          hint="ҰБТ сертификатының анық фотосы немесе скриншоты. Басқанда толық көрінеді."
          value={certificate}
          onChange={setCertificate}
          onBusy={onBusy}
          shape="certificate"
          error={fe.certificate_path}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-[1fr_140px]">
        <Field id="student_name" label="Түлектің аты-жөні *" error={fe.student_name}>
          <Input id="student_name" name="student_name" defaultValue={initial?.student_name ?? ""} placeholder="Төлеген Данияр" maxLength={80} invalid={!!fe.student_name} />
        </Field>
        <Field id="score" label="ҰБТ балы" error={fe.score}>
          <Input id="score" name="score" type="number" min={0} max={140} defaultValue={initial?.score ?? ""} placeholder="128" invalid={!!fe.score} />
        </Field>
      </div>
      <Field id="score_label" label="Балл жазуы (міндетті емес)" error={fe.score_label} hint="Бос болса — «128 балл». Мысалы: «Математика: 50/50»">
        <Input id="score_label" name="score_label" defaultValue={initial?.score_label ?? ""} maxLength={40} />
      </Field>
      <Field id="text" label="Пікір мәтіні *" error={fe.text} hint="Абзацтарды бос жолмен бөліңіз">
        <Textarea id="text" name="text" defaultValue={initial?.text ?? ""} rows={8} maxLength={4000} invalid={!!fe.text} />
      </Field>
      <Field id="position" label="Реті" error={fe.position} hint="Кіші сан — бірінші көрінеді">
        <Input id="position" name="position" type="number" min={1} max={1000} defaultValue={initial?.position ?? 1} className="max-w-32" invalid={!!fe.position} />
      </Field>
      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-brand-300">
        <input type="checkbox" name="is_published" defaultChecked={initial?.is_published ?? true} className="size-5 accent-brand-500" />
        <span className="font-medium text-slate-800">Басты бетте көрсету</span>
      </label>
      <SubmitButton pendingText="Сақталуда..." disabled={busy > 0}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
