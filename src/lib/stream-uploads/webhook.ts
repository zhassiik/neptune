import { createHmac, timingSafeEqual } from "node:crypto";
import { parseWebhookSignature, WEBHOOK_TOLERANCE_SECONDS } from "./rules";

export type WebhookCheck = { ok: true } | { ok: false; reason: "missing_secret" | "bad_header" | "expired" | "bad_signature" };

/**
 * Cloudflare Stream webhook қолтаңбасын тексеру (ресми құжат бойынша):
 * HMAC-SHA256(secret, `${time}.${rawBody}`) hex түрінде == sig1, салыстыру — тұрақты уақытта.
 * Ескі сұраныстар (WEBHOOK_TOLERANCE_SECONDS-тан ескі немесе болашақтағы) қабылданбайды.
 */
export function verifyWebhookSignature(rawBody: string, header: string | null | undefined, secret: string | null | undefined, nowSeconds = Math.floor(Date.now() / 1000)): WebhookCheck {
  if (!secret) return { ok: false, reason: "missing_secret" };
  const parsed = parseWebhookSignature(header);
  if (!parsed) return { ok: false, reason: "bad_header" };
  if (Math.abs(nowSeconds - parsed.time) > WEBHOOK_TOLERANCE_SECONDS) return { ok: false, reason: "expired" };

  const expected = createHmac("sha256", secret).update(`${parsed.time}.${rawBody}`, "utf8").digest();
  const given = Buffer.from(parsed.sig1, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "bad_signature" };
  return { ok: true };
}

/** Тесттер мен қолмен тексеру үшін: Cloudflare сияқты қолтаңба жасау */
export function signWebhookBody(rawBody: string, secret: string, time = Math.floor(Date.now() / 1000)) {
  const sig = createHmac("sha256", secret).update(`${time}.${rawBody}`, "utf8").digest("hex");
  return `time=${time},sig1=${sig}`;
}
