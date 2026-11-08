import { authorizeLesson, json, removeTargetVideo, toErrorResponse } from "@/lib/stream-uploads/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** ҰБТ нұсқасының Cloudflare видео-талдауын өшіру (admin немесе осы курстың мұғалімі) */
export async function DELETE(_request: Request, { params }: { params: Promise<{ variantId: string }> }) {
  try {
    const { lesson, admin, target } = await authorizeLesson((await params).variantId);
    const message = await removeTargetVideo(admin, target, lesson);
    return json({ ok: true, message });
  } catch (err) {
    return toErrorResponse(err, "stream-lesson");
  }
}
