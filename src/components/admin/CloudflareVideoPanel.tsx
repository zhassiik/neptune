"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, CircleAlert, Eye, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { SecureVideoPlayer } from "@/components/video/SecureVideoPlayer";
import { useToast } from "./Toast";
import { refreshCloudflareVideo, secureCloudflareVideo } from "@/lib/admin/actions";
import type { StreamVideoInfo } from "@/lib/cloudflare/stream";
import { formatMinutes } from "@/lib/video";

export interface StreamSetup {
  missing: string[];
  apiConfigured: boolean;
  desiredOrigins: string[];
}

const STATE_LABELS: Record<string, string> = {
  ready: "Дайын",
  inprogress: "Өңделуде",
  queued: "Кезекте",
  downloading: "Жүктелуде",
  pendingupload: "Жүктелуін күтуде",
  error: "Қате",
};

/** Әкімшіге: Cloudflare видеосының күйі, қорғау және preview */
export function CloudflareVideoPanel({
  variantId,
  uid,
  status,
  setup,
  watermark,
}: {
  variantId: string;
  uid: string;
  status: string | null;
  setup: StreamSetup;
  watermark: { name: string; email: string };
}) {
  const toast = useToast();
  const [info, setInfo] = useState<StreamVideoInfo | null>(null);
  const [preview, setPreview] = useState(false);
  const [checking, startCheck] = useTransition();
  const [securing, startSecure] = useTransition();

  const check = () =>
    startCheck(async () => {
      const res = await refreshCloudflareVideo(variantId);
      if (res.ok) setInfo(res.info);
      else toast(res.error, "error");
    });

  const secure = () =>
    startSecure(async () => {
      const res = await secureCloudflareVideo(variantId);
      if (res.ok) {
        setInfo(res.info);
        toast(res.message ?? "Сақталды");
      } else toast(res.error, "error");
    });

  const state = info?.state ?? status;
  const originsOk = info ? setup.desiredOrigins.every((o) => info.allowedOrigins.includes(o)) : null;

  return (
    <div className="card mb-6 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ShieldCheck className="size-5 text-brand-500" /> Видео-талдау: Cloudflare Stream
          </h2>
          <p className="mt-1 font-mono text-xs break-all text-slate-500">Video UID: {uid}</p>
        </div>
        {state && <Badge tone={state === "ready" ? "green" : state === "error" ? "red" : "amber"}>{STATE_LABELS[state] ?? state}</Badge>}
      </div>

      {setup.missing.length > 0 && (
        <Alert tone="error" className="mt-4">
          <b>.env.local толық емес — оқушылар видеоны көре алмайды.</b> Жетіспейтін мәндер:
          <ul className="mt-1 list-inside list-disc font-mono text-xs">
            {setup.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <p className="mt-1">Мәндерді енгізгеннен кейін серверді қайта іске қосыңыз.</p>
        </Alert>
      )}

      {info && (
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <Check ok={info.readyToStream} label={info.readyToStream ? "Видео ойнатуға дайын" : "Видео әлі өңделуде"} />
          <Check ok={info.requireSignedURLs} label={info.requireSignedURLs ? "Signed URL қорғауы қосулы" : "Signed URL қорғауы ӨШІРУЛІ — видео ашық!"} />
          <Check
            ok={!!originsOk}
            label={info.allowedOrigins.length ? `Рұқсат етілген домендер: ${info.allowedOrigins.join(", ")}` : "Домен шектеуі жоқ (allowedOrigins бос)"}
          />
          <Check ok label={`Ұзақтығы: ${formatMinutes(info.durationSeconds ? Math.round(info.durationSeconds / 60) : null) ?? "белгісіз"}`} />
        </ul>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={check} loading={checking} disabled={!setup.apiConfigured}>
          <RefreshCw className="size-4" /> Cloudflare-дан тексеру
        </Button>
        <Button size="sm" onClick={secure} loading={securing} disabled={!setup.apiConfigured}>
          <ShieldCheck className="size-4" /> Қорғауды орнату
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setPreview((p) => !p)}>
          <Eye className="size-4" /> {preview ? "Preview жабу" : "Preview (оқушы көретіндей)"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        «Қорғауды орнату»: requireSignedURLs = true және allowedOrigins = {setup.desiredOrigins.join(", ") || "—"}.
        {!setup.apiConfigured && " (CLOUDFLARE_ACCOUNT_ID және CLOUDFLARE_API_TOKEN қажет)"}
      </p>

      {preview && (
        <div className="mt-5">
          <SecureVideoPlayer variantId={variantId} title="Preview" watermark={watermark} />
        </div>
      )}
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-start gap-2 rounded-xl px-3 py-2 ${ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}
      <span className="break-all">{label}</span>
    </li>
  );
}
