import { describe, expect, it } from "vitest";
import { createPublicKey, createVerify, generateKeyPairSync } from "node:crypto";
import { allowedOriginsFor, extractVideoUid, loadSigningKey, normalizeCustomerCode, playbackUrls, signStreamToken } from "./token";

const UID = "ea95132c15732412d22c1476fa83f27a";

describe("extractVideoUid", () => {
  it("UID-дің өзін немесе сілтемеден алады", () => {
    expect(extractVideoUid(UID)).toBe(UID);
    expect(extractVideoUid(UID.toUpperCase())).toBe(UID);
    expect(extractVideoUid(`https://customer-abc123.cloudflarestream.com/${UID}/iframe`)).toBe(UID);
    expect(extractVideoUid(`https://dash.cloudflare.com/123/stream/videos/${UID}`)).toBe(UID);
  });
  it("қате мәндерді қабылдамайды", () => {
    expect(extractVideoUid("")).toBeNull();
    expect(extractVideoUid("abc")).toBeNull();
    expect(extractVideoUid("g".repeat(32))).toBeNull();
    expect(extractVideoUid("a".repeat(33))).toBeNull();
  });
});

describe("normalizeCustomerCode", () => {
  it("әртүрлі форматтарды қабылдайды", () => {
    expect(normalizeCustomerCode("abc123xyz")).toBe("abc123xyz");
    expect(normalizeCustomerCode("customer-abc123xyz")).toBe("abc123xyz");
    expect(normalizeCustomerCode("https://customer-abc123xyz.cloudflarestream.com/x")).toBe("abc123xyz");
    expect(normalizeCustomerCode("")).toBeNull();
    expect(normalizeCustomerCode("bad code!")).toBeNull();
  });
});

describe("signStreamToken", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  it("RS256 қолтаңбасы дұрыс, мерзімі 1 сағат, UID — sub", () => {
    const now = Date.UTC(2026, 9, 26, 12, 0, 0);
    const { token, expiresAt } = signStreamToken({ uid: UID, keyId: "key123", privateKey: loadSigningKey(pem), now });
    const [h, p, sig] = token.split(".");
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(header).toEqual({ alg: "RS256", kid: "key123" });
    expect(payload.sub).toBe(UID);
    expect(payload.kid).toBe("key123");
    expect(payload.exp - now / 1000).toBe(3600);
    expect(payload.downloadable).toBe(false);
    expect(expiresAt).toBe(new Date(now + 3600_000).toISOString());
    const ok = createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(sig, "base64url"));
    expect(ok).toBe(true);
  });

  it("Cloudflare форматтарын оқиды: base64 PEM, \\n-мен PEM, base64 JWK", () => {
    const base64Pem = Buffer.from(pem).toString("base64");
    const escaped = pem.replace(/\n/g, "\\n");
    const jwk = Buffer.from(JSON.stringify(privateKey.export({ format: "jwk" }))).toString("base64");
    for (const raw of [base64Pem, escaped, jwk, `"${escaped}"`]) {
      const key = loadSigningKey(raw);
      expect(createPublicKey(key).export({ type: "spki", format: "pem" })).toBe(publicKey.export({ type: "spki", format: "pem" }));
    }
    expect(() => loadSigningKey("not-a-key")).toThrow();
  });
});

describe("playbackUrls / allowedOriginsFor", () => {
  it("customer subdomain арқылы HLS сілтемесі (UID емес, token)", () => {
    expect(playbackUrls("abc123", "TOKEN").hls).toBe("https://customer-abc123.cloudflarestream.com/TOKEN/manifest/video.m3u8");
  });
  it("production: тек өз домені; development: + localhost:3000; қосымша тізім", () => {
    expect(allowedOriginsFor({ appUrl: "https://neptune-ubt.kz", nodeEnv: "production", extra: "" })).toEqual(["neptune-ubt.kz"]);
    expect(allowedOriginsFor({ appUrl: "https://neptune-ubt.kz", nodeEnv: "development", extra: undefined })).toEqual(["neptune-ubt.kz", "localhost:3000"]);
    expect(allowedOriginsFor({ appUrl: undefined, nodeEnv: "production", extra: "http://192.168.0.107:3000/, www.neptune-ubt.kz" })).toEqual([
      "192.168.0.107:3000",
      "www.neptune-ubt.kz",
    ]);
  });
});
