import { authorizeTarget, json, removeTargetVideo, toErrorResponse } from "@/lib/stream-uploads/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Курс сабағының (кіріспе / блоктағы видео) Cloudflare видеосын өшіру */
export async function DELETE(_request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    const { lesson, admin, target } = await authorizeTarget("lesson", (await params).lessonId);
    const message = await removeTargetVideo(admin, target, lesson);
    return json({ ok: true, message });
  } catch (err) {
    return toErrorResponse(err, "stream-module-lesson");
  }
}
