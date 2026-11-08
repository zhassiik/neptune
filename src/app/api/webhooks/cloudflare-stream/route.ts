import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/stream-uploads/webhook";
import { deleteReplacedVideos, json, syncVideo, targetOfRow, toErrorResponse, type VideoRow } from "@/lib/stream-uploads/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 256 * 1024;

/**
 * Cloudflare Stream webhook: видео өңделіп біткенде (ready) немесе қатемен аяқталғанда шақырылады.
 * 1) Webhook-Signature (HMAC-SHA256, CLOUDFLARE_STREAM_WEBHOOK_SECRET) тексеріледі — қолтаңбасыз сұраныс 401.
 * 2) Денедегі күйге сенбейміз: UID бойынша нақты күй Cloudflare API-дан қайта алынады (syncVideo).
 * Бет жабылып қалса да, видео дайын болғанда сабақ осы жерде жаңарады.
 */
export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);

  const secret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[stream-webhook] CLOUDFLARE_STREAM_WEBHOOK_SECRET орнатылмаған — webhook қабылданбайды");
    return json({ error: "Webhook is not configured" }, 503);
  }
  const check = verifyWebhookSignature(raw, request.headers.get("webhook-signature"), secret);
  if (!check.ok) {
    console.warn("[stream-webhook] rejected:", check.reason);
    return json({ error: "Invalid signature" }, 401);
  }

  let uid = "";
  try {
    uid = String((JSON.parse(raw) as { uid?: unknown }).uid ?? "").toLowerCase();
  } catch {
    return json({ error: "Bad payload" }, 400);
  }
  if (!/^[a-f0-9]{32}$/.test(uid)) return json({ error: "Bad payload" }, 400);

  try {
    const admin = createAdminClient();
    const { data: row, error } = await admin.from("stream_videos").select("*").eq("cloudflare_uid", uid).maybeSingle<VideoRow>();
    if (error) throw new Error(`webhook lookup: ${error.message}`);
    // Сайттан жүктелмеген (қолмен қосылған) видео — бізге қатысы жоқ, сәтті деп жауап береміз
    if (!row) return json({ ok: true, ignored: true });

    const synced = await syncVideo(admin, row);
    await deleteReplacedVideos(admin, targetOfRow(synced));
    return json({ ok: true, status: synced.status });
  } catch (err) {
    // 5xx — Cloudflare webhook-ты кейін қайта жібереді
    return toErrorResponse(err, "stream-webhook");
  }
}
