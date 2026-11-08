/**
 * Cloudflare Stream-ға тікелей жүктеу: таза (I/O жоқ) ережелер.
 * Клиентте де, серверде де қолданылады — құпия ақпарат жоқ.
 */

export type StreamVideoStatus = "waiting" | "uploading" | "processing" | "ready" | "error";

/** Cloudflare Stream қабылдайтын контейнерлер (MP4, MKV, MOV, AVI, FLV, MPEG-2 TS/PS, MXF, LXF, GXF, 3GP, WebM, MPG, QuickTime) */
export const VIDEO_EXTENSIONS = ["mp4", "m4v", "mov", "qt", "mkv", "webm", "avi", "flv", "mpg", "mpeg", "ts", "m2ts", "mts", "mxf", "lxf", "gxf", "3gp"] as const;

/** Cloudflare Stream-ның бір файлға шегі — 30 ГБ */
export const MAX_UPLOAD_BYTES = 30 * 1024 ** 3;

/** tus бөлігі: 50 МиБ (Cloudflare ұсынысы; 256 КиБ-қа бөлінеді, 5–200 МиБ аралығында) */
export const TUS_CHUNK_SIZE = 50 * 1024 * 1024;

/** Сайттан басталған жүктеудің жарамдылық мерзімі (Cloudflare expiry) */
export const UPLOAD_LINK_TTL_MS = 5 * 60 * 60 * 1000 + 50 * 60 * 1000;

/** Бір пайдаланушыға: RATE_LIMIT_WINDOW_MIN минут ішінде ең көбі RATE_LIMIT_MAX жүктеу сілтемесі */
export const RATE_LIMIT_MAX = 12;
export const RATE_LIMIT_WINDOW_MIN = 15;

export const ACCEPT_ATTRIBUTE = ["video/*", ...VIDEO_EXTENSIONS.map((e) => `.${e}`)].join(",");

const EXTRA_MIME = new Set(["application/octet-stream", "application/mxf", "application/x-matroska", "application/vnd.rn-realmedia"]);

export function fileExtension(name: string) {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

export type FileProblem = { code: "empty" | "too_large" | "unsupported" | "bad_name"; message: string };

/** Жүктеуді бастамас бұрын файл түрі мен көлемін тексеру (клиентте және серверде бірдей) */
export function validateUploadFile(file: { name: string; size: number; type?: string | null }): FileProblem | null {
  const name = file.name?.trim() ?? "";
  if (!name || name.length > 255) return { code: "bad_name", message: "Файл атауы жарамсыз. Файлды қайта атап, қайталап көріңіз" };
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return { code: "empty", message: "Файл бос. Басқа видео таңдаңыз" };
  if (file.size > MAX_UPLOAD_BYTES) return { code: "too_large", message: `Файл тым үлкен (${formatBytes(file.size)}). Ең көбі — ${formatBytes(MAX_UPLOAD_BYTES)}` };

  const ext = fileExtension(name);
  const type = (file.type ?? "").toLowerCase().trim();
  const extOk = (VIDEO_EXTENSIONS as readonly string[]).includes(ext);
  const typeOk = !type || type.startsWith("video/") || EXTRA_MIME.has(type);
  if (!extOk || !typeOk) {
    return { code: "unsupported", message: "Бұл формат қолдау көрсетілмейді. MP4, MOV, MKV, WebM, AVI немесе басқа видеофайл таңдаңыз" };
  }
  return null;
}

/** Файл атауынан басқару таңбаларын алып тастау (Cloudflare meta.name және дерекқор үшін) */
export function sanitizeFilename(name: string) {
  const clean = name.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  return clean.slice(0, 255) || "video";
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")} ${units[i]}`;
}

/* ------------------------------ tus metadata ------------------------------ */

const toBase64 = (s: string) => (typeof Buffer !== "undefined" ? Buffer.from(s, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(s))));
const fromBase64 = (s: string) => (typeof Buffer !== "undefined" ? Buffer.from(s, "base64").toString("utf8") : decodeURIComponent(escape(atob(s))));

/** Upload-Metadata: «кілт base64,кілт2 base64,жалауша» (мәні null — тек кілт) */
export function encodeTusMetadata(meta: Record<string, string | null>) {
  return Object.entries(meta)
    .map(([k, v]) => (v === null ? k : `${k} ${toBase64(v)}`))
    .join(",");
}

export function parseTusMetadata(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const pair of header.split(",")) {
    const m = /^([A-Za-z0-9_.-]{1,64})(?: ([A-Za-z0-9+/]*={0,2}))?$/.exec(pair.trim());
    if (!m) continue;
    const [, key, value] = m;
    try {
      out[key] = value ? fromBase64(value) : "";
    } catch {
      out[key] = "";
    }
  }
  return out;
}

/* ------------------------------ Cloudflare күйі ------------------------------ */

const ERROR_REASONS: Record<string, string> = {
  ERR_NON_VIDEO: "Файл видео емес немесе зақымдалған. Басқа файлды жүктеп көріңіз",
  ERR_MALFORMED_VIDEO: "Видео файлы зақымдалған. Видеоны қайта экспорттап, қайталап көріңіз",
  ERR_DURATION_EXCEED_CONSTRAINT: "Видео тым ұзын — рұқсат етілген ұзақтықтан асады",
  ERR_DURATION_TOO_SHORT: "Видео тым қысқа",
  ERR_FETCH_ORIGIN_ERROR: "Видео файлын алу мүмкін болмады. Қайта жүктеп көріңіз",
};

export const GENERIC_PROCESSING_ERROR = "Cloudflare видеоны өңдей алмады. Басқа файлмен қайталап көріңіз";

export function processingErrorMessage(code: string | null | undefined) {
  return (code && ERROR_REASONS[code]) || GENERIC_PROCESSING_ERROR;
}

export interface CloudflareVideoState {
  state: string | null;
  readyToStream: boolean;
  errReasonCode?: string | null;
}

/** Cloudflare күйін сайттағы күйге айналдыру. «pending» — файл әлі толық жүктелмеген */
export function mapCloudflareState(v: CloudflareVideoState): { status: "pending" | "processing" | "ready" | "error"; message: string | null } {
  if (v.state === "error") return { status: "error", message: processingErrorMessage(v.errReasonCode) };
  if (v.readyToStream || v.state === "ready") return { status: "ready", message: null };
  if (v.state === "pendingupload" || !v.state) return { status: "pending", message: null };
  return { status: "processing", message: null }; // downloading, queued, inprogress
}

export const STATUS_TEXT: Record<StreamVideoStatus, string> = {
  waiting: "Жүктеуге дайындалуда",
  uploading: "Жүктелуде",
  processing: "Видео жүктелді. Cloudflare видеоны өңдеп жатыр",
  ready: "Видео көруге дайын",
  error: "Қате",
};

/* ------------------------------ Webhook қолтаңбасы ------------------------------ */

export const WEBHOOK_TOLERANCE_SECONDS = 15 * 60;

/** «time=1230811200,sig1=60493ec9...» → { time, sig1 } */
export function parseWebhookSignature(header: string | null | undefined): { time: number; sig1: string } | null {
  if (!header || header.length > 512) return null;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return i > 0 ? [p.slice(0, i).trim(), p.slice(i + 1).trim()] : [p.trim(), ""];
    }),
  );
  const time = Number(parts.time);
  const sig1 = String(parts.sig1 ?? "").toLowerCase();
  if (!Number.isSafeInteger(time) || time <= 0 || !/^[a-f0-9]{64}$/.test(sig1)) return null;
  return { time, sig1 };
}
