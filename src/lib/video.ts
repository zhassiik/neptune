/**
 * Видео-талдау сілтемелерін өңдеу.
 * Қолдау: YouTube (unlisted болуы мүмкін), Vimeo, Kinescope, тікелей .mp4/.webm файл.
 */

export type VideoSource =
  | { kind: "iframe"; provider: "youtube" | "vimeo" | "kinescope"; src: string }
  | { kind: "file"; src: string };

export function parseVideoUrl(raw: string | null | undefined): VideoSource | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") {
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
    else if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/);
      id = m?.[1] ?? null;
    }
    if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
    return { kind: "iframe", provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = url.pathname.match(/(?:\/video)?\/(\d+)(?:\/([\da-f]+))?/);
    if (!m) return null;
    const hash = m[2] ?? url.searchParams.get("h");
    return { kind: "iframe", provider: "vimeo", src: `https://player.vimeo.com/video/${m[1]}${hash ? `?h=${hash}` : ""}` };
  }

  if (host === "kinescope.io") {
    const m = url.pathname.match(/^\/(?:embed\/)?([\w-]+)/);
    if (!m) return null;
    return { kind: "iframe", provider: "kinescope", src: `https://kinescope.io/embed/${m[1]}` };
  }

  if (/\.(mp4|webm|m4v)$/i.test(url.pathname) && url.protocol === "https:") {
    return { kind: "file", src: url.toString() };
  }

  return null;
}

/** 101 → «1 сағ 41 мин» */
export function formatMinutes(minutes: number | null | undefined) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} мин`;
  return m ? `${h} сағ ${m} мин` : `${h} сағ`;
}

/** «НҰСҚА 1. Контекст Қарағай ағашы» */
export function variantHeading(v: { position: number; title: string }) {
  return `НҰСҚА ${v.position}. ${v.title}`;
}

/** Нұсқада видео-талдау бар ма (сілтеме немесе Cloudflare Stream) */
export function hasVideo(v: { video_provider?: string | null; video_url: string | null; cloudflare_video_uid?: string | null }) {
  return v.video_provider === "cloudflare" ? !!v.cloudflare_video_uid : !!v.video_url;
}
