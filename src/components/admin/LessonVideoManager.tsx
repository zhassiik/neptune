"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DetailedError, Upload } from "tus-js-client";
import { CheckCircle2, CloudUpload, FileVideo, Loader2, RefreshCw, Trash2, Video, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { SecureVideoPlayer } from "@/components/video/SecureVideoPlayer";
import { ACCEPT_ATTRIBUTE, formatBytes, STATUS_TEXT, TUS_CHUNK_SIZE, validateUploadFile } from "@/lib/stream-uploads/rules";
import type { LessonVideoState, VideoView } from "@/lib/stream-uploads/server";

type Phase = "creating" | "uploading" | "processing" | "ready" | "error" | "interrupted";

interface Job {
  phase: Phase;
  fileName: string;
  sizeBytes: number | null;
  progress: number;
  bytesSent: number;
  videoId: string | null;
  message: string | null;
  /** Желі үзілгенде: сол файлмен жалғастыруға болады */
  canResume: boolean;
}

const BUSY: Phase[] = ["creating", "uploading", "processing"];
const STORE_PREFIX = "nep-upload:";

function jobFromView(v: VideoView | null): Job | null {
  if (!v || v.removed) return null;
  const base = { fileName: v.fileName, sizeBytes: v.sizeBytes, bytesSent: 0, videoId: v.id, canResume: false };
  if (v.status === "waiting" || v.status === "uploading") {
    return { ...base, phase: "interrupted", progress: 0, message: "Жүктеу аяқталмай қалды (бет жабылған немесе байланыс үзілген). Жалғастыру үшін сол файлды қайта таңдаңыз" };
  }
  if (v.status === "processing") return { ...base, phase: "processing", progress: 100, message: null };
  if (v.status === "error") return { ...base, phase: "error", progress: 0, message: v.message };
  return null;
}

// localStorage — тек осы браузерде үзілген жүктеуді жалғастыру үшін (міндетті емес; қолжетімсіз болса елемейміз)
const remember = (key: string, videoId: string) => {
  try {
    localStorage.setItem(STORE_PREFIX + key, videoId);
  } catch {}
};
const recall = (key: string) => {
  try {
    return localStorage.getItem(STORE_PREFIX + key);
  } catch {
    return null;
  }
};
const forget = (key: string) => {
  try {
    localStorage.removeItem(STORE_PREFIX + key);
  } catch {}
};

function apiMessage(status: number, body: string | null | undefined) {
  if (status === 401) return "Сессия аяқталды. Жүйеге қайта кіріп, видеоны қайта жүктеңіз";
  if (status === 403) return "Бұл сабаққа видео жүктеуге рұқсатыңыз жоқ";
  try {
    const parsed = JSON.parse(body ?? "") as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {}
  return "Сервер қатесі. Біраздан кейін қайталап көріңіз";
}

/** tus қатесін мұғалімге түсінікті мәтінге айналдыру */
function describeUploadError(err: Error | DetailedError): { message: string; network: boolean } {
  const detailed = err as DetailedError;
  const status = detailed.originalResponse?.getStatus?.() ?? 0;
  const url = detailed.originalRequest?.getURL?.() ?? "";
  if (!status) {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    return {
      network: true,
      message: offline
        ? "Интернет байланысы жоқ. Байланыс қалпына келгенде «Жалғастыру» батырмасын басыңыз"
        : "Байланыс үзілді. «Жалғастыру» батырмасын басыңыз — жүктеу тоқтаған жерінен жалғасады",
    };
  }
  if (url.includes("/api/admin/stream/")) return { network: false, message: apiMessage(status, detailed.originalResponse?.getBody?.()) };
  if (status === 404 || status === 410 || status === 403) return { network: false, message: "Жүктеу сілтемесінің мерзімі өтті. Видеоны қайта жүктеңіз" };
  if (status === 413) return { network: false, message: "Файл Cloudflare шегінен үлкен" };
  return { network: false, message: "Cloudflare файлды қабылдамады. Біраздан кейін қайталап көріңіз" };
}

/**
 * «Видео урока»: файл браузерден Cloudflare Stream-ға тікелей жүктеледі (tus, үзілсе жалғасады).
 * Сервер тек бір реттік сілтеме жасайды және күйді Supabase-ке жазады. Video UID-ді қолмен көшірудің қажеті жоқ.
 */
export function LessonVideoManager({
  variantId,
  lessonId,
  state,
  configured,
  watermark,
}: {
  /** ҰБТ нұсқасының видео-талдауы */
  variantId?: string;
  /** Немесе курс сабағы (кіріспе / блоктағы видео) */
  lessonId?: string;
  state: LessonVideoState;
  /** Cloudflare API серверде бапталған ба (құпия мәндер клиентке берілмейді) */
  configured: boolean;
  watermark: { name: string; email: string };
}) {
  const router = useRouter();
  // Видео қайда бекітіледі: нұсқа немесе курс сабағы
  const targetId = (lessonId ?? variantId)!;
  const uploadQuery = lessonId ? `lessonId=${encodeURIComponent(lessonId)}` : `variantId=${encodeURIComponent(variantId!)}`;
  const deleteUrl = lessonId ? `/api/admin/stream/module-lessons/${lessonId}/video` : `/api/admin/stream/lessons/${variantId}/video`;
  const tokenUrl = lessonId ? `/api/video/lesson/${lessonId}/token` : `/api/video/${variantId}/token`;
  const [job, setJob] = useState<Job | null>(() => jobFromView(state.latest));
  const [notice, setNotice] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<Upload | null>(null);
  const replaceRef = useRef(false);
  const fileRef = useRef<File | null>(null);

  const currentUid = state.currentUid;
  const hasVideo = !!currentUid || state.hasOtherVideo;
  const busy = !!job && BUSY.includes(job.phase);
  const uploading = job?.phase === "creating" || job?.phase === "uploading";

  /* ---------- серверден келген күйді қолдану ---------- */
  const applyView = useCallback(
    (v: VideoView) => {
      if (v.status === "ready") {
        setJob((j) => (j ? { ...j, phase: "ready", progress: 100, message: null } : j));
        router.refresh();
      } else if (v.status === "error") {
        setJob((j) => (j ? { ...j, phase: "error", message: v.message ?? "Cloudflare видеоны өңдей алмады" } : j));
      } else if (v.status === "processing") {
        setJob((j) => (j ? { ...j, phase: "processing", progress: 100 } : j));
      }
    },
    [router],
  );

  /* ---------- желі күйі ---------- */
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  /* ---------- жүктеу кезінде бетті жабуды ескерту ---------- */
  useEffect(() => {
    if (!uploading) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [uploading]);

  /* ---------- өңдеу кезінде күйді серверден сұрау ---------- */
  const videoId = job?.videoId ?? null;
  const phase = job?.phase;
  useEffect(() => {
    if (!videoId || (phase !== "processing" && phase !== "interrupted")) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();
    const tick = async () => {
      try {
        const res = await fetch(`/api/admin/stream/videos/${videoId}`, { cache: "no-store" });
        if (stopped) return;
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          const message = apiMessage(res.status, await res.text());
          setJob((j) => (j ? { ...j, phase: "error", message } : j));
          return;
        }
        if (res.ok) {
          const { video } = (await res.json()) as { video: VideoView };
          applyView(video);
          if (video.status !== "processing") return;
        }
      } catch {
        /* желі уақытша жоқ — келесі тексеруде қайталанады */
      }
      if (stopped || phase === "interrupted") return;
      timer = setTimeout(tick, Date.now() - startedAt > 120_000 ? 15_000 : 5_000);
    };
    // «interrupted»: бір рет тексереміз — мүмкін файл толық жүктеліп үлгерген
    timer = setTimeout(tick, phase === "interrupted" ? 0 : 3_000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [videoId, phase, applyView]);

  const patch = (id: string, action: "started" | "uploaded") =>
    fetch(`/api/admin/stream/videos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) })
      .then(async (r) => (r.ok ? ((await r.json()) as { video: VideoView }).video : null))
      .catch(() => null);

  /* ---------- жүктеу ---------- */
  const startUpload = async (file: File) => {
    if (uploadRef.current) return; // қайта басу
    setNotice(null);
    const problem = validateUploadFile(file);
    if (problem) {
      setJob({ phase: "error", fileName: file.name, sizeBytes: file.size, progress: 0, bytesSent: 0, videoId: null, message: problem.message, canResume: false });
      return;
    }
    fileRef.current = file;
    const previousJob = job;
    setJob({ phase: "creating", fileName: file.name, sizeBytes: file.size, progress: 0, bytesSent: 0, videoId: null, message: null, canResume: false });

    const tus = await import("tus-js-client");
    const key = ["nep", targetId, file.name, file.size, file.lastModified].join("|");
    let id: string | null = null;
    let startedSent = false;

    const upload = new tus.Upload(file, {
      endpoint: `/api/admin/stream/uploads?${uploadQuery}&replace=${replaceRef.current ? 1 : 0}`,
      chunkSize: TUS_CHUNK_SIZE,
      retryDelays: [0, 2_000, 5_000, 10_000, 20_000, 30_000],
      metadata: { filename: file.name, filetype: file.type || "application/octet-stream" },
      fingerprint: async () => key,
      storeFingerprintForResuming: true,
      removeFingerprintOnSuccess: true,
      onAfterResponse: (req, res) => {
        if (req.getMethod() !== "POST") return;
        const created = res.getHeader("X-Video-Id");
        if (res.getStatus() === 201 && created) {
          id = created;
          remember(key, created);
          setJob((j) => (j ? { ...j, videoId: created, phase: "uploading" } : j));
        }
      },
      onProgress: (sent, total) => {
        const progress = total ? Math.min(99, Math.floor((sent / total) * 100)) : 0;
        setJob((j) => (j ? { ...j, phase: "uploading", progress, bytesSent: sent, message: null, canResume: false } : j));
        if (!startedSent && id) {
          startedSent = true;
          void patch(id, "started");
        }
      },
      // Тек желі қатесі мен Cloudflare-дың уақытша қателері қайталанады; сайттың 4xx жауаптары — жоқ
      onShouldRetry: (err) => {
        const status = err.originalResponse?.getStatus?.() ?? 0;
        return !status || status >= 500 || status === 423;
      },
      onError: (err) => {
        uploadRef.current = null;
        const { message, network } = describeUploadError(err);
        if (!network) forget(key);
        setJob((j) => (j ? { ...j, phase: "error", message, canResume: network } : j));
      },
      onSuccess: async () => {
        uploadRef.current = null;
        forget(key);
        setJob((j) => (j ? { ...j, phase: "processing", progress: 100, bytesSent: j.sizeBytes ?? j.bytesSent, message: null } : j));
        if (id) {
          const v = await patch(id, "uploaded");
          if (v) applyView(v);
        }
      },
    });
    uploadRef.current = upload;

    // Үзілген жүктеу: сол файл және сервердегі жазба әлі белсенді болса — тоқтаған жерінен жалғастырамыз
    try {
      const previous = await upload.findPreviousUploads();
      const storedId = recall(key);
      const resumable = previousJob?.phase === "interrupted" || previousJob?.canResume ? previousJob.videoId : null;
      const match = storedId && storedId === resumable ? previous.find((p) => p.uploadUrl) : undefined;
      if (match && storedId) {
        id = storedId;
        startedSent = true;
        setJob((j) => (j ? { ...j, videoId: storedId, phase: "uploading" } : j));
        upload.resumeFromPreviousUpload(match);
      } else {
        for (const p of previous) await tus.defaultOptions.urlStorage.removeUpload(p.urlStorageKey).catch(() => undefined);
        forget(key);
      }
    } catch {
      /* localStorage қолжетімсіз — жаңадан бастаймыз */
    }
    upload.start();
  };

  const resume = () => {
    const file = fileRef.current;
    if (file && job?.canResume) {
      void startUpload(file);
    } else {
      fileInput.current?.click();
    }
  };

  const cancel = async () => {
    const up = uploadRef.current;
    uploadRef.current = null;
    if (up) await up.abort(false).catch(() => undefined);
    const id = job?.videoId;
    setJob(null);
    setNotice("Жүктеу тоқтатылды");
    if (id) await fetch(`/api/admin/stream/videos/${id}`, { method: "DELETE" }).catch(() => undefined);
    router.refresh();
  };

  const choose = () => {
    if (busy) return;
    if (hasVideo) {
      setConfirmReplace(true);
    } else {
      replaceRef.current = false;
      fileInput.current?.click();
    }
  };

  const removeVideo = async () => {
    setDeleting(true);
    try {
      const res = await fetch(deleteUrl, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) {
        setNotice(body.error ?? apiMessage(res.status, null));
      } else {
        setNotice(body.message ?? "Видео өшірілді");
        setJob(null);
        router.refresh();
      }
    } catch {
      setNotice("Байланыс үзілді. Қайталап көріңіз");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  /* ---------- көрініс ---------- */
  const statusBadge = (s: string | null) =>
    s === "ready" ? <Badge tone="green">Дайын</Badge> : s === "error" ? <Badge tone="red">Қате</Badge> : <Badge tone="amber">Өңделуде</Badge>;

  return (
    <section className="card mb-6 p-5 sm:p-7" aria-labelledby="lesson-video-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="lesson-video-title" className="flex items-center gap-2 text-lg font-bold">
            <Video className="size-5 text-brand-500" /> Сабақ видеосы
          </h2>
          <p className="mt-1 text-sm text-slate-500">Видео компьютерден тікелей Cloudflare Stream-ға жүктеледі және сабаққа автоматты бекітіледі.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={choose} disabled={busy || !configured || state.notMigrated} size="sm">
            <CloudUpload className="size-4" /> {hasVideo ? "Видеоны ауыстыру" : "Видео жүктеу"}
          </Button>
          {currentUid && (
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} disabled={uploading || deleting} className="text-red-600 hover:text-red-700">
              <Trash2 className="size-4" /> Видеоны өшіру
            </Button>
          )}
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void startUpload(file);
        }}
      />

      {!configured && (
        <Alert tone="warning" className="mt-4">
          Cloudflare Stream серверде бапталмаған (CLOUDFLARE_ACCOUNT_ID және API token қажет). Сайт әкімшісіне хабарласыңыз.
        </Alert>
      )}
      {state.notMigrated && (
        <Alert tone="warning" className="mt-4">
          Деректер базасы жаңартылмаған: Supabase SQL Editor-да <code>20261107000001_stream_uploads.sql</code> migration-ын іске қосыңыз.
        </Alert>
      )}
      {notice && (
        <Alert tone="info" className="mt-4">
          {notice}
        </Alert>
      )}

      {/* Жүктеу / өңдеу барысы */}
      {job && (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4" aria-live="polite">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-brand-500 shadow-sm">
              <FileVideo className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-navy-900" title={job.fileName}>
                {job.fileName}
              </div>
              <div className="text-xs text-slate-500">
                {job.sizeBytes ? formatBytes(job.sizeBytes) : ""}
                {job.phase === "uploading" && job.sizeBytes ? ` · жүктелді ${formatBytes(job.bytesSent)}` : ""}
              </div>
            </div>
            {(uploading || job.phase === "interrupted") && (
              <Button variant="ghost" size="sm" onClick={cancel} aria-label="Жүктеуді тоқтату">
                <X className="size-4" /> <span className="hidden sm:inline">Тоқтату</span>
              </Button>
            )}
          </div>

          {(job.phase === "creating" || job.phase === "uploading") && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium text-brand-700">
                  <Loader2 className="size-4 animate-spin" /> {job.phase === "creating" ? "Жүктеуге дайындалуда…" : STATUS_TEXT.uploading}
                </span>
                <b className="tabular-nums text-navy-900">{job.progress}%</b>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.progress} aria-label="Жүктеу барысы">
                <div className="h-full rounded-full bg-brand-500 transition-[width] duration-300" style={{ width: `${job.progress}%` }} />
              </div>
              {!online && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-700">
                  <WifiOff className="size-4" /> Интернет жоқ — байланыс қалпына келгенде жүктеу өзі жалғасады
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">Жүктеу аяқталғанша бетті жаппаңыз.</p>
            </div>
          )}

          {job.phase === "processing" && (
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-amber-700">
              <Loader2 className="size-4 animate-spin" /> {STATUS_TEXT.processing}. Бетті жабуға болады — дайын болғанда сабаққа өзі бекітіледі.
            </p>
          )}

          {job.phase === "ready" && (
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="size-4" /> {STATUS_TEXT.ready}
            </p>
          )}

          {(job.phase === "error" || job.phase === "interrupted") && (
            <div className="mt-4 space-y-3">
              <Alert tone={job.phase === "error" ? "error" : "warning"}>{job.message ?? "Жүктеу сәтсіз аяқталды"}</Alert>
              <div className="flex flex-wrap gap-2">
                {job.canResume ? (
                  <Button size="sm" onClick={resume}>
                    <RefreshCw className="size-4" /> Жалғастыру
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()} disabled={!configured}>
                    <CloudUpload className="size-4" /> {job.phase === "interrupted" ? "Файлды қайта таңдау" : "Басқа файл таңдау"}
                  </Button>
                )}
                {job.phase === "error" && (
                  <Button size="sm" variant="ghost" onClick={() => setJob(null)}>
                    Жабу
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ағымдағы видео */}
      {currentUid ? (
        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-navy-900">Ағымдағы видео</span>
            {statusBadge(state.currentStatus === "ready" ? "ready" : state.currentStatus === "error" ? "error" : state.currentStatus ? "processing" : "ready")}
            {job?.phase === "processing" && <span className="text-xs text-slate-500">(жаңа видео дайын болғанша оқушылар осыны көреді)</span>}
          </div>
          <SecureVideoPlayer key={currentUid} tokenUrl={tokenUrl} title="Сабақ видеосы" watermark={watermark} />
        </div>
      ) : (
        !job && (
          <p className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            {state.hasOtherVideo ? "Сабақта сыртқы сілтеме (YouTube т.б.) арқылы видео бар. Cloudflare-ға жүктеп, оны ауыстыруға болады." : "Бұл сабаққа әлі видео жүктелмеген."}
          </p>
        )
      )}

      <Modal
        open={confirmReplace}
        onClose={() => setConfirmReplace(false)}
        title="Видеоны ауыстыру"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReplace(false)}>
              Жоқ
            </Button>
            <Button
              onClick={() => {
                replaceRef.current = true;
                setConfirmReplace(false);
                fileInput.current?.click();
              }}
            >
              Иә, ауыстыру
            </Button>
          </>
        }
      >
        <p className="text-slate-700">Бұл сабақта видео бар. Оны жаңа видеомен ауыстырасыз ба?</p>
        <p className="mt-2 text-sm text-slate-500">Ескі видео жаңасы толық жүктеліп, Cloudflare өңдеп болғаннан кейін ғана өшіріледі. Оған дейін оқушылар ескі видеоны көреді.</p>
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        locked={deleting}
        title="Видеоны өшіру"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Жоқ
            </Button>
            <Button variant="danger" onClick={removeVideo} loading={deleting}>
              Иә, өшіру
            </Button>
          </>
        }
      >
        <p className="text-slate-700">Сабақ видеосын өшіресіз бе? Видео Cloudflare-дан да өшіріледі, оқушылар оны енді көре алмайды.</p>
      </Modal>
    </section>
  );
}
