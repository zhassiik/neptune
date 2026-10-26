/**
 * Cloudflare Stream: таза көмекші функциялар (Node.js crypto, сыртқы тәуелділіксіз).
 * Бұл файл тек серверде қолданылады (stream.ts арқылы), бірақ тестілеу үшін server-only белгісі жоқ.
 */
import { createPrivateKey, createSign, type KeyObject } from "node:crypto";

export const STREAM_TOKEN_TTL_SECONDS = 60 * 60; // 1 сағат

/** Video UID немесе UID бар Cloudflare сілтемесінен 32 таңбалы UID-ді алады */
export function extractVideoUid(input: string | null | undefined): string | null {
  if (!input) return null;
  const match = input.trim().toLowerCase().match(/(?:^|[^a-f0-9])([a-f0-9]{32})(?:[^a-f0-9]|$)/);
  return match ? match[1] : null;
}

/** «customer-abc123», «abc123», «https://customer-abc123.cloudflarestream.com» → «abc123» */
export function normalizeCustomerCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const code = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\.cloudflarestream\.com.*$/, "")
    .replace(/^customer-/, "");
  return /^[a-z0-9]{6,64}$/.test(code) ? code : null;
}

/**
 * Signing key-ді оқиды. Cloudflare API (POST /stream/keys) қайтаратын:
 *  - «pem» өрісі (base64-ке кодталған PEM) немесе
 *  - «jwk» өрісі (base64-ке кодталған JWK),
 * сондай-ақ жай PEM мәтіні (\n арқылы бір жолға жазылған болса да).
 */
export function loadSigningKey(raw: string): KeyObject {
  const value = raw.trim().replace(/^["']|["']$/g, "");
  const asPem = value.replace(/\\n/g, "\n");
  if (asPem.includes("-----BEGIN")) return createPrivateKey(asPem);

  const decoded = Buffer.from(value, "base64").toString("utf8").trim();
  if (decoded.includes("-----BEGIN")) return createPrivateKey(decoded);
  if (decoded.startsWith("{")) return createPrivateKey({ key: JSON.parse(decoded), format: "jwk" });
  if (value.startsWith("{")) return createPrivateKey({ key: JSON.parse(value), format: "jwk" });

  throw new Error("CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY форматы танылмады (PEM немесе JWK керек)");
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/** Cloudflare Stream signed token (RS256 JWT) — серверде жергілікті жасалады */
export function signStreamToken({
  uid,
  keyId,
  privateKey,
  ttlSeconds = STREAM_TOKEN_TTL_SECONDS,
  now = Date.now(),
}: {
  uid: string;
  keyId: string;
  privateKey: KeyObject;
  ttlSeconds?: number;
  now?: number;
}) {
  const iat = Math.floor(now / 1000);
  const exp = iat + ttlSeconds;
  const header = { alg: "RS256", kid: keyId };
  // nbf: сағаттардың сәл айырмашылығына төзімділік; downloadable: жүктеп алуға тыйым
  const payload = { sub: uid, kid: keyId, exp, nbf: iat - 60, downloadable: false };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey);
  return { token: `${unsigned}.${b64url(signature)}`, expiresAt: new Date(exp * 1000).toISOString() };
}

export function playbackUrls(customerCode: string, token: string) {
  const base = `https://customer-${customerCode}.cloudflarestream.com/${token}`;
  return {
    hls: `${base}/manifest/video.m3u8`,
    poster: `${base}/thumbnails/thumbnail.jpg?time=2s&height=720`,
  };
}

/**
 * Cloudflare-да рұқсат етілетін домендер (allowedOrigins):
 * production домені + development кезінде localhost:3000 + қосымша тізім.
 */
export function allowedOriginsFor({
  appUrl,
  nodeEnv,
  extra,
}: {
  appUrl: string | undefined;
  nodeEnv: string | undefined;
  extra: string | undefined;
}) {
  const origins = new Set<string>();
  if (appUrl) {
    try {
      const host = new URL(appUrl).host;
      if (host) origins.add(host);
    } catch {
      /* қате URL — елемейміз */
    }
  }
  if (nodeEnv !== "production") origins.add("localhost:3000");
  for (const item of (extra ?? "").split(",")) {
    const host = item.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (host) origins.add(host);
  }
  return [...origins];
}
