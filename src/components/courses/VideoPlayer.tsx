import { VideoOff } from "lucide-react";
import { parseVideoUrl } from "@/lib/video";

export function VideoPlayer({ url, title }: { url: string | null; title: string }) {
  const source = parseVideoUrl(url);
  if (!source) {
    return (
      <div className="grid aspect-video place-items-center rounded-2xl bg-slate-100 text-center text-slate-500">
        <div>
          <VideoOff className="mx-auto size-8" />
          <p className="mt-2 text-sm">Видео әлі қосылмаған</p>
        </div>
      </div>
    );
  }
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-black shadow-lift">
      {source.kind === "file" ? (
        <video src={source.src} controls controlsList="nodownload" playsInline className="absolute inset-0 size-full" title={title} />
      ) : (
        <iframe
          src={source.src}
          title={title}
          className="absolute inset-0 size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </div>
  );
}
