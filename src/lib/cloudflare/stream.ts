import "server-only";
import type { KeyObject } from "node:crypto";
import {
  allowedOriginsFor,
  loadSigningKey,
  normalizeCustomerCode,
  playbackUrls,
  signStreamToken,
  STREAM_TOKEN_TTL_SECONDS,
} from "./token";

/** Пайдаланушыға құпия ақпаратсыз көрсетілетін қате */
export class StreamConfigError extends Error {}

interface StreamConfig {
  accountId: string | null;
  apiToken: string | null;
  customerCode: string | null;
  keyId: string | null;
  privateKey: KeyObject | null;
  missing: string[];
}

let cachedKey: { raw: string; key: KeyObject } | null = null;

export function getStreamConfig(): StreamConfig {
  const env = process.env;
  const missing: string[] = [];
  const customerCode = normalizeCustomerCode(env.CLOUDFLARE_STREAM_CUSTOMER_CODE);
  if (!customerCode) missing.push("CLOUDFLARE_STREAM_CUSTOMER_CODE");

  let privateKey: KeyObject | null = null;
  const rawKey = env.CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY?.trim();
  if (rawKey) {
    try {
      if (cachedKey?.raw !== rawKey) cachedKey = { raw: rawKey, key: loadSigningKey(rawKey) };
      privateKey = cachedKey.key;
    } catch {
      missing.push("CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY (формат қате)");
    }
  }
  const keyId = env.CLOUDFLARE_STREAM_SIGNING_KEY_ID?.trim() || null;
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim() || null;
  const apiToken = env.CLOUDFLARE_API_TOKEN?.trim() || null;

  // Token жасаудың екі жолы: signing key (ұсынылады) немесе API token (резерв)
  if (!(keyId && privateKey) && !(accountId && apiToken)) {
    missing.push("CLOUDFLARE_STREAM_SIGNING_KEY_ID + CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY (немесе CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN)");
  }
  return { accountId, apiToken, customerCode, keyId, privateKey, missing };
}

/** Видео ойнатуға арналған қысқа мерзімді signed URL (1 сағат) */
export async function createPlayback(uid: string) {
  const cfg = getStreamConfig();
  if (!cfg.customerCode) throw new StreamConfigError("Cloudflare Stream бапталмаған");

  if (cfg.keyId && cfg.privateKey) {
    const { token, expiresAt } = signStreamToken({ uid, keyId: cfg.keyId, privateKey: cfg.privateKey });
    return { ...playbackUrls(cfg.customerCode, token), expiresAt };
  }

  if (cfg.accountId && cfg.apiToken) {
    // Резерв: Cloudflare API арқылы token алу (жоғары жүктемеге signing key ұсынылады)
    const exp = Math.floor(Date.now() / 1000) + STREAM_TOKEN_TTL_SECONDS;
    const res = await cfFetch(`/stream/${uid}/token`, { method: "POST", body: JSON.stringify({ exp, downloadable: false }) });
    const token = (res as { token?: string }).token;
    if (!token) throw new Error("Cloudflare token қайтармады");
    return { ...playbackUrls(cfg.customerCode, token), expiresAt: new Date(exp * 1000).toISOString() };
  }

  throw new StreamConfigError("Cloudflare Stream бапталмаған");
}

/* ---------------------------- Cloudflare API ---------------------------- */

interface CfEnvelope<T> {
  success: boolean;
  errors?: { code: number; message: string }[];
  result: T;
}

async function cfFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { accountId, apiToken } = getStreamConfig();
  if (!accountId || !apiToken) throw new StreamConfigError("CLOUDFLARE_ACCOUNT_ID және CLOUDFLARE_API_TOKEN орнатылмаған");
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => null)) as CfEnvelope<T> | null;
  if (!res.ok || !body?.success) {
    const message = body?.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
    if (res.status === 404) throw new StreamConfigError("Бұл Video UID Cloudflare Stream-да табылмады");
    if (res.status === 401 || res.status === 403) throw new StreamConfigError("Cloudflare API token-ның Stream рұқсаты жоқ немесе қате");
    throw new Error(`Cloudflare API: ${message}`);
  }
  return body.result;
}

export interface StreamVideoInfo {
  uid: string;
  state: string;
  readyToStream: boolean;
  durationSeconds: number | null;
  requireSignedURLs: boolean;
  allowedOrigins: string[];
}

interface CfVideo {
  uid: string;
  readyToStream: boolean;
  duration: number;
  requireSignedURLs: boolean;
  allowedOrigins: string[];
  status?: { state?: string };
}

function toInfo(v: CfVideo): StreamVideoInfo {
  return {
    uid: v.uid,
    state: v.status?.state ?? (v.readyToStream ? "ready" : "unknown"),
    readyToStream: v.readyToStream,
    durationSeconds: v.duration > 0 ? Math.round(v.duration) : null,
    requireSignedURLs: v.requireSignedURLs,
    allowedOrigins: v.allowedOrigins ?? [],
  };
}

export async function getVideoInfo(uid: string) {
  return toInfo(await cfFetch<CfVideo>(`/stream/${uid}`));
}

export function desiredAllowedOrigins() {
  return allowedOriginsFor({
    appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL,
    nodeEnv: process.env.NODE_ENV,
    extra: process.env.CLOUDFLARE_STREAM_EXTRA_ORIGINS,
    vercelProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  });
}

/**
 * requireSignedURLs=true және allowedOrigins-ті видеоға орнатады.
 * Бұрынғы домендер сақталады (біріктіріледі): production-да басқанда localhost өшпейді, локалда басқанда production домені өшпейді.
 */
export async function secureVideo(uid: string) {
  const current = await getVideoInfo(uid).catch(() => null);
  const allowedOrigins = [...new Set([...(current?.allowedOrigins ?? []), ...desiredAllowedOrigins()])];
  const result = await cfFetch<CfVideo>(`/stream/${uid}`, {
    method: "POST",
    body: JSON.stringify({ uid, requireSignedURLs: true, allowedOrigins }),
  });
  return toInfo(result);
}
