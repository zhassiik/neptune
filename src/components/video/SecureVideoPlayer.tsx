"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type HlsType from "hls.js";
import { AlertTriangle, Check, Loader2, Lock, Maximize, Minimize, Pause, Play, RotateCcw, Settings, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Watermark } from "./Watermark";

interface Playback {
  hls: string;
  poster: string;
  expiresAt: string;
}

type Phase = "loading" | "ready" | "error";
type FullscreenMode = "none" | "native" | "pseudo";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const REFRESH_BEFORE_MS = 5 * 60_000;

function formatTime(t: number) {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function errorMessage(status: number, body: { error?: string }) {
  if (status === 401) return "Видеоны көру үшін жүйеге кіріңіз";
  if (status === 403) return "Бұл видеоны көруге рұқсатыңыз жоқ";
  if (status === 404) return "Видео табылмады";
  if (status === 503) return "Видео уақытша қолжетімсіз. Кейінірек қайталап көріңіз";
  return body.error || "Видеоны жүктеу мүмкін болмады";
}

/**
 * Cloudflare Stream қорғалған плеері:
 * - signed URL серверден алынады (1 сағат), мерзімі бітер алдында автоматты жаңартылады;
 * - hls.js: сапа автоматты бейімделеді, Auto / 360p / 480p / 720p / 1080p таңдауы;
 * - өз басқару батырмалары: жүктеп алу батырмасы жоқ, оң жақ мәзір бұғатталған;
 * - watermark плеер контейнерінің ішінде — толық экранда да көрінеді.
 */
export function SecureVideoPlayer({
  variantId,
  title,
  watermark,
}: {
  variantId: string;
  title: string;
  watermark: { name: string; email: string };
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HlsType | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoveringRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<{ message: string; denied: boolean } | null>(null);
  const [poster, setPoster] = useState<string | undefined>();
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [levels, setLevels] = useState<{ index: number; height: number }[]>([]);
  const [level, setLevel] = useState(-1);
  const [autoHeight, setAutoHeight] = useState<number | null>(null);
  const [nativeHls, setNativeHls] = useState(false);
  const [rate, setRate] = useState(1);
  const [menu, setMenu] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState<FullscreenMode>("none");

  /* -------------------------- Signed URL алу -------------------------- */

  const fetchPlayback = useCallback(async (): Promise<Playback> => {
    const res = await fetch(`/api/video/${variantId}/token`, { method: "POST", cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(errorMessage(res.status, body)) as Error & { denied?: boolean };
      err.denied = res.status === 403 || res.status === 401;
      throw err;
    }
    return body as Playback;
  }, [variantId]);

  const destroyHls = () => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
  };

  const scheduleRefresh = useCallback((expiresAt: string) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const delay = Math.max(30_000, new Date(expiresAt).getTime() - Date.now() - REFRESH_BEFORE_MS);
    refreshTimer.current = setTimeout(() => void reloadWithFreshToken(), delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Видеоны берілген позициядан бастап жүктеу (token жаңарғанда да қолданылады) */
  const attach = useCallback(
    async (playback: Playback, startAt = 0, resume = false) => {
      const video = videoRef.current;
      if (!video) return;
      destroyHls();
      setPoster(playback.poster);
      scheduleRefresh(playback.expiresAt);

      const restore = () => {
        if (startAt > 0) video.currentTime = startAt;
        if (resume) void video.play().catch(() => {});
        setPhase("ready");
      };

      const { default: Hls } = await import("hls.js");
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, maxBufferLength: 30, startLevel: -1 });
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          const unique = new Map<number, number>();
          data.levels.forEach((l, index) => {
            if (l.height && !unique.has(l.height)) unique.set(l.height, index);
          });
          setLevels([...unique.entries()].map(([height, index]) => ({ height, index })).sort((a, b) => b.height - a.height));
          setLevel(-1);
          restore();
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setAutoHeight(hls.levels[data.level]?.height ?? null));
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          const code = data.response?.code;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && (code === 401 || code === 403) && !recoveringRef.current) {
            recoveringRef.current = true;
            void reloadWithFreshToken().finally(() => (recoveringRef.current = false));
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR && code !== 404) {
            hls.startLoad();
          } else {
            setError({ message: code === 404 ? "Видео әлі дайын емес немесе табылмады" : "Видеоны ойнату мүмкін болмады", denied: false });
            setPhase("error");
          }
        });
        hls.loadSource(playback.hls);
        hls.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // iPhone/Safari: кірістірілген HLS (сапа автоматты бейімделеді)
        setNativeHls(true);
        video.src = playback.hls;
        video.addEventListener("loadedmetadata", restore, { once: true });
      } else {
        setError({ message: "Бұл браузер видеоны ойната алмайды. Chrome, Safari немесе Firefox-тың жаңа нұсқасын қолданыңыз", denied: false });
        setPhase("error");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheduleRefresh],
  );

  const reloadWithFreshToken = useCallback(async () => {
    const video = videoRef.current;
    try {
      const playback = await fetchPlayback();
      await attach(playback, video?.currentTime ?? 0, video ? !video.paused : false);
    } catch (e) {
      setError({ message: (e as Error).message, denied: !!(e as { denied?: boolean }).denied });
      setPhase("error");
    }
  }, [attach, fetchPlayback]);

  const load = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      await attach(await fetchPlayback());
    } catch (e) {
      setError({ message: (e as Error).message, denied: !!(e as { denied?: boolean }).denied });
      setPhase("error");
    }
  }, [attach, fetchPlayback]);

  useEffect(() => {
    void load();
    return () => {
      destroyHls();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [load]);

  /* ----------------------------- Басқару ----------------------------- */

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || phase !== "ready") return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }, [phase]);

  const seekBy = (delta: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.min(Math.max(0, v.currentTime + delta), v.duration || 0);
  };

  const isNativeFs = () => !!(document.fullscreenElement || (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement);

  const toggleFullscreen = useCallback(async () => {
    const el = wrapperRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> }) | null;
    if (!el) return;
    if (fullscreen === "pseudo") return setFullscreen("none");
    if (isNativeFs()) {
      const d = document as Document & { webkitExitFullscreen?: () => Promise<void> };
      await (document.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
      return;
    }
    try {
      // Контейнерді (видео + watermark) толық экранға шығарамыз — watermark жасырылмайды
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      else throw new Error("unsupported");
      try {
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape");
      } catch {}
    } catch {
      // iPhone: элементті толық экранға шығару мүмкін емес → бет үстіне толық экран режимі
      setFullscreen("pseudo");
    }
  }, [fullscreen]);

  useEffect(() => {
    const onChange = () => setFullscreen(isNativeFs() ? "native" : (f) => (f === "native" ? "none" : f));
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  useEffect(() => {
    if (fullscreen !== "pseudo") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullscreen("none");
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  const pokeControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
    }, 2800);
  }, []);

  const chooseLevel = (index: number) => {
    const hls = hlsRef.current;
    if (hls) hls.currentLevel = index;
    setLevel(index);
    setMenu(false);
  };

  const chooseRate = (r: number) => {
    if (videoRef.current) videoRef.current.playbackRate = r;
    setRate(r);
    setMenu(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    const key = e.key.toLowerCase();
    if (key === " " || key === "k") togglePlay();
    else if (key === "arrowright") seekBy(10);
    else if (key === "arrowleft") seekBy(-10);
    else if (key === "f") void toggleFullscreen();
    else if (key === "m" && videoRef.current) videoRef.current.muted = !videoRef.current.muted;
    else return;
    e.preventDefault();
    pokeControls();
  };

  const currentQualityLabel = level === -1 ? `Auto${autoHeight ? ` (${autoHeight}p)` : ""}` : `${levels.find((l) => l.index === level)?.height}p`;
  const showOverlayControls = controlsVisible || !playing || menu;

  /* ------------------------------ Көрініс ------------------------------ */

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseMove={pokeControls}
      onTouchStart={pokeControls}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "group/player relative overflow-hidden bg-black outline-none select-none focus-visible:ring-4 focus-visible:ring-brand-300",
        fullscreen === "none" && "aspect-video w-full rounded-2xl shadow-lift",
        fullscreen === "native" && "h-full w-full",
        fullscreen === "pseudo" && "fixed inset-0 z-[100] h-[100dvh] w-screen",
        playing && !showOverlayControls && "cursor-none",
      )}
      aria-label={`Видеоплеер: ${title}`}
    >
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        preload="metadata"
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noplaybackrate noremoteplayback"
        className="absolute inset-0 h-full w-full object-contain"
        onClick={() => {
          togglePlay();
          pokeControls();
        }}
        onDoubleClick={() => void toggleFullscreen()}
        onPlay={() => {
          setPlaying(true);
          setStarted(true);
        }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onVolumeChange={(e) => {
          setMuted(e.currentTarget.muted);
          setVolume(e.currentTarget.volume);
        }}
      />

      {/* Watermark: контейнер ішінде, сондықтан толық экранда да көрінеді */}
      {phase === "ready" && <Watermark name={watermark.name} email={watermark.email} />}

      {/* Жүктелу */}
      {(phase === "loading" || (buffering && phase === "ready")) && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-3 text-white">
            <Loader2 className="size-10 animate-spin opacity-90" />
            {phase === "loading" && <span className="text-sm opacity-80">Видео жүктелуде...</span>}
          </div>
        </div>
      )}

      {/* Қате / рұқсат жоқ */}
      {phase === "error" && error && (
        <div className="absolute inset-0 grid place-items-center bg-navy-900/95 p-6 text-center text-white">
          <div className="max-w-sm">
            <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-white/10">
              {error.denied ? <Lock className="size-7" /> : <AlertTriangle className="size-7" />}
            </div>
            <p className="font-semibold">{error.message}</p>
            {!error.denied && (
              <button
                type="button"
                onClick={() => void load()}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold transition hover:bg-white/25 active:scale-95"
              >
                <RotateCcw className="size-4" /> Қайталау
              </button>
            )}
          </div>
        </div>
      )}

      {/* Ортадағы үлкен play батырмасы */}
      {phase === "ready" && !playing && !buffering && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute top-[42%] left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 sm:top-1/2 sm:size-18 place-items-center rounded-full bg-brand-500/90 text-white shadow-lift transition hover:scale-105 hover:bg-brand-500 active:scale-95"
          aria-label={started ? "Жалғастыру" : "Ойнату"}
        >
          <Play className="ml-1 size-6 fill-current sm:size-8" />
        </button>
      )}

      {/* Төменгі басқару панелі */}
      {phase === "ready" && (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pt-6 pb-1.5 sm:pt-10 text-white transition-opacity duration-300 sm:px-4 sm:pb-3",
            showOverlayControls ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <div className="relative mb-2 h-1.5 rounded-full bg-white/25">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/40" style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-brand-400" style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={1}
              value={time}
              onChange={(e) => {
                const v = videoRef.current;
                if (v) v.currentTime = Number(e.target.value);
                setTime(Number(e.target.value));
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Видео уақыты"
            />
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <button type="button" onClick={togglePlay} className="rounded-lg p-2 transition hover:bg-white/15 active:scale-90" aria-label={playing ? "Тоқтату" : "Ойнату"}>
              {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
            </button>
            <button
              type="button"
              onClick={() => {
                if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
              }}
              className="rounded-lg p-2 transition hover:bg-white/15 active:scale-90"
              aria-label={muted ? "Дыбысты қосу" : "Дыбысты өшіру"}
            >
              {muted || volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = videoRef.current;
                if (!v) return;
                v.volume = Number(e.target.value);
                v.muted = v.volume === 0;
              }}
              className="hidden w-20 accent-brand-400 sm:block"
              aria-label="Дыбыс деңгейі"
            />
            <span className="ml-1 text-xs font-medium tabular-nums sm:text-sm">
              {formatTime(time)} / {formatTime(duration)}
            </span>

            <div className="relative ml-auto">
              <button
                type="button"
                onClick={() => setMenu((m) => !m)}
                className="inline-flex items-center gap-1.5 rounded-lg p-2 text-xs font-semibold transition hover:bg-white/15 active:scale-90"
                aria-expanded={menu}
                aria-label="Баптаулар: сапа және жылдамдық"
              >
                <Settings className={cn("size-5 transition", menu && "rotate-45")} />
                <span className="hidden sm:inline">{nativeHls ? "Auto" : currentQualityLabel}</span>
              </button>
              {menu && (
                <div className="absolute right-0 bottom-12 z-10 w-52 overflow-hidden rounded-xl bg-navy-900/95 py-1 text-sm shadow-lift backdrop-blur" onClick={(e) => e.stopPropagation()}>
                  <div className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-white/50 uppercase">Сапасы</div>
                  <MenuItem active={level === -1} onClick={() => chooseLevel(-1)}>
                    Auto{autoHeight && level === -1 ? ` (${autoHeight}p)` : ""}
                  </MenuItem>
                  {nativeHls ? (
                    <p className="px-3 py-1.5 text-xs text-white/50">Бұл құрылғыда сапа интернет жылдамдығына қарай автоматты таңдалады</p>
                  ) : (
                    levels.map((l) => (
                      <MenuItem key={l.index} active={level === l.index} onClick={() => chooseLevel(l.index)}>
                        {l.height}p
                      </MenuItem>
                    ))
                  )}
                  <div className="mt-1 border-t border-white/10 px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-white/50 uppercase">Жылдамдық</div>
                  <div className="flex flex-wrap gap-1 px-2 pb-2">
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => chooseRate(s)}
                        className={cn("rounded-md px-2 py-1 text-xs font-semibold transition", rate === s ? "bg-brand-500" : "hover:bg-white/15")}
                      >
                        {s}×
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button type="button" onClick={() => void toggleFullscreen()} className="rounded-lg p-2 transition hover:bg-white/15 active:scale-90" aria-label={fullscreen === "none" ? "Толық экран" : "Толық экраннан шығу"}>
              {fullscreen === "none" ? <Maximize className="size-5" /> : <Minimize className="size-5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex w-full items-center justify-between px-3 py-2 text-left transition hover:bg-white/10", active && "text-brand-300")}>
      {children}
      {active && <Check className="size-4" />}
    </button>
  );
}
