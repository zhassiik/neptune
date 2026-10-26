"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImagePlus, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_MB, optimizeImage, validateImageFile } from "@/lib/admin/image";
import { humanizeError, cn, uuid } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { discardUploadedImage } from "@/lib/admin/actions";

const BUCKET = "question-images";

export interface ImageValue {
  path: string | null;
  url: string | null;
}

export function ImageUploader({
  variantId,
  position,
  value,
  savedPath,
  onChange,
  invalid,
}: {
  variantId: string;
  position: number;
  value: ImageValue;
  /** Базада сақталған сурет (оны бірден өшірмейміз — тек сақтағанда) */
  savedPath: string | null;
  onChange: (v: ImageValue) => void;
  invalid?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    const invalidMsg = validateImageFile(file);
    if (invalidMsg) {
      setError(invalidMsg);
      return;
    }
    setUploading(true);
    try {
      const optimized = await optimizeImage(file);
      const path = `variants/${variantId}/q${position}-${uuid()}.${optimized.ext}`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, optimized.blob, {
        contentType: optimized.type,
        cacheControl: "31536000",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
      if (signErr) throw signErr;

      // Алдыңғы сақталмаған жүктемені тазалау
      if (value.path && value.path !== savedPath) void discardUploadedImage(value.path);
      onChange({ path, url: data.signedUrl });
    } catch (e) {
      setError(`Жүктеу сәтсіз: ${humanizeError(e)}`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove() {
    if (value.path && value.path !== savedPath) void discardUploadedImage(value.path);
    onChange({ path: null, url: null });
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
        aria-label="Сурет таңдау"
      />
      {value.url ? (
        <div className="rounded-2xl border border-slate-200 p-3">
          <div className="relative overflow-hidden rounded-xl bg-slate-50">
            <Image
              src={value.url}
              alt="Сұрақ суретінің preview"
              width={0}
              height={0}
              sizes="(max-width: 1024px) 100vw, 700px"
              className="mx-auto h-auto max-h-[420px] w-auto max-w-full object-contain"
              unoptimized
            />
            {uploading && (
              <div className="absolute inset-0 grid place-items-center bg-white/70">
                <Spinner className="size-6 text-brand-500" />
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} loading={uploading}>
              <RefreshCw className="size-4" /> Ауыстыру
            </Button>
            <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={remove} disabled={uploading}>
              <Trash2 className="size-4" /> Суретті алып тастау
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          disabled={uploading}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition active:scale-[0.99]",
            dragOver ? "border-brand-500 bg-brand-50" : invalid ? "border-red-300 bg-red-50/40" : "border-slate-200 hover:border-brand-300 hover:bg-brand-50/40",
          )}
        >
          {uploading ? (
            <>
              <Spinner className="size-7 text-brand-500" />
              <span className="text-sm font-medium text-slate-600">Сурет оңтайландырылып, жүктелуде...</span>
            </>
          ) : (
            <>
              <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-500">
                {dragOver ? <UploadCloud className="size-6" /> : <ImagePlus className="size-6" />}
              </span>
              <span className="font-semibold text-navy-900">Суретті осында сүйреп әкеліңіз немесе басып таңдаңыз</span>
              <span className="text-xs text-slate-500">JPG, PNG, WebP · максимум {MAX_UPLOAD_MB} МБ · үлкен суреттер автоматты кішірейтіледі</span>
            </>
          )}
        </button>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
