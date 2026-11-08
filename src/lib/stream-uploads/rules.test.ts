import { describe, expect, it } from "vitest";
import {
  ACCEPT_ATTRIBUTE,
  encodeTusMetadata,
  formatBytes,
  mapCloudflareState,
  MAX_UPLOAD_BYTES,
  parseTusMetadata,
  parseWebhookSignature,
  processingErrorMessage,
  sanitizeFilename,
  TUS_CHUNK_SIZE,
  validateUploadFile,
} from "./rules";
import { signWebhookBody, verifyWebhookSignature } from "./webhook";

describe("validateUploadFile", () => {
  it("Cloudflare қабылдайтын видеоларды өткізеді", () => {
    expect(validateUploadFile({ name: "Талдау 1.mp4", size: 10_000_000, type: "video/mp4" })).toBeNull();
    expect(validateUploadFile({ name: "lesson.MOV", size: 1, type: "video/quicktime" })).toBeNull();
    expect(validateUploadFile({ name: "lesson.mkv", size: 5, type: "" })).toBeNull(); // браузер MIME бермеуі мүмкін
    expect(validateUploadFile({ name: "lesson.mxf", size: 5, type: "application/mxf" })).toBeNull();
    expect(validateUploadFile({ name: "a.webm", size: MAX_UPLOAD_BYTES, type: "video/webm" })).toBeNull();
  });
  it("видео емес файлды қабылдамайды", () => {
    expect(validateUploadFile({ name: "notes.pdf", size: 100, type: "application/pdf" })?.code).toBe("unsupported");
    expect(validateUploadFile({ name: "photo.jpg", size: 100, type: "image/jpeg" })?.code).toBe("unsupported");
    expect(validateUploadFile({ name: "video.mp4", size: 100, type: "image/png" })?.code).toBe("unsupported"); // кеңейтімі жалған
    expect(validateUploadFile({ name: "noext", size: 100, type: "video/mp4" })?.code).toBe("unsupported");
  });
  it("бос және тым үлкен файл", () => {
    expect(validateUploadFile({ name: "a.mp4", size: 0, type: "video/mp4" })?.code).toBe("empty");
    expect(validateUploadFile({ name: "a.mp4", size: Number.NaN, type: "video/mp4" })?.code).toBe("empty");
    expect(validateUploadFile({ name: "a.mp4", size: MAX_UPLOAD_BYTES + 1, type: "video/mp4" })?.code).toBe("too_large");
  });
  it("атауы жарамсыз", () => {
    expect(validateUploadFile({ name: "", size: 10, type: "video/mp4" })?.code).toBe("bad_name");
    expect(validateUploadFile({ name: `${"a".repeat(260)}.mp4`, size: 10, type: "video/mp4" })?.code).toBe("bad_name");
  });
  it("accept атрибуты видеоларды қамтиды", () => {
    expect(ACCEPT_ATTRIBUTE).toContain("video/*");
    expect(ACCEPT_ATTRIBUTE).toContain(".mov");
  });
});

describe("tus", () => {
  it("chunk Cloudflare талабына сай: 5–200 МиБ, 256 КиБ-қа бөлінеді", () => {
    expect(TUS_CHUNK_SIZE % (256 * 1024)).toBe(0);
    expect(TUS_CHUNK_SIZE).toBeGreaterThanOrEqual(5_242_880);
    expect(TUS_CHUNK_SIZE).toBeLessThanOrEqual(209_715_200);
  });
  it("Upload-Metadata кодтау/декодтау (кирилл, жалауша)", () => {
    const header = encodeTusMetadata({ name: "Нұсқа №1.mp4", requiresignedurls: null, maxDurationSeconds: "600" });
    expect(header).toBe(`name ${Buffer.from("Нұсқа №1.mp4").toString("base64")},requiresignedurls,maxDurationSeconds NjAw`);
    expect(parseTusMetadata(header)).toEqual({ name: "Нұсқа №1.mp4", requiresignedurls: "", maxDurationSeconds: "600" });
    expect(parseTusMetadata(null)).toEqual({});
    expect(parseTusMetadata("bad key!! xx,ok YQ==")).toEqual({ ok: "a" });
  });
  it("файл атауынан басқару таңбалары алынады", () => {
    expect(sanitizeFilename("  a\u0000b\nc.mp4 ")).toBe("abc.mp4");
    expect(sanitizeFilename("\u0000")).toBe("video");
    expect(sanitizeFilename("x".repeat(400)).length).toBe(255);
  });
  it("formatBytes", () => {
    expect(formatBytes(500)).toBe("500 Б");
    expect(formatBytes(1536)).toBe("1.5 КБ");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3 ГБ");
  });
});

describe("mapCloudflareState", () => {
  it("күйлерді сайттағы күйге айналдырады", () => {
    expect(mapCloudflareState({ state: "pendingupload", readyToStream: false }).status).toBe("pending");
    expect(mapCloudflareState({ state: "queued", readyToStream: false }).status).toBe("processing");
    expect(mapCloudflareState({ state: "inprogress", readyToStream: false }).status).toBe("processing");
    expect(mapCloudflareState({ state: "inprogress", readyToStream: true }).status).toBe("ready");
    expect(mapCloudflareState({ state: "ready", readyToStream: true }).status).toBe("ready");
  });
  it("қате себебі түсінікті мәтінмен", () => {
    const r = mapCloudflareState({ state: "error", readyToStream: false, errReasonCode: "ERR_NON_VIDEO" });
    expect(r.status).toBe("error");
    expect(r.message).toMatch(/видео емес/);
    expect(processingErrorMessage("SOMETHING_NEW")).toMatch(/өңдей алмады/);
  });
});

describe("webhook қолтаңбасы", () => {
  const secret = "85011ed3a913c6ad5f9cf6c5573cc0a7";
  const body = JSON.stringify({ uid: "6b9e68b07dfee8cc2d116e4c51d6a957", readyToStream: true, status: { state: "ready" } });
  const now = 1_790_000_000;

  it("Cloudflare құжатындағы алгоритм: HMAC-SHA256(time + '.' + body)", () => {
    const header = signWebhookBody(body, secret, now);
    expect(header).toMatch(/^time=1790000000,sig1=[a-f0-9]{64}$/);
    expect(verifyWebhookSignature(body, header, secret, now)).toEqual({ ok: true });
  });
  it("денесі өзгертілген — қабылданбайды", () => {
    const header = signWebhookBody(body, secret, now);
    expect(verifyWebhookSignature(body.replace("ready", "error"), header, secret, now)).toEqual({ ok: false, reason: "bad_signature" });
  });
  it("басқа секретпен қол қойылған — қабылданбайды", () => {
    expect(verifyWebhookSignature(body, signWebhookBody(body, "wrong-secret", now), secret, now)).toEqual({ ok: false, reason: "bad_signature" });
  });
  it("ескі немесе болашақтағы уақыт — қабылданбайды (replay)", () => {
    expect(verifyWebhookSignature(body, signWebhookBody(body, secret, now - 3600), secret, now).ok).toBe(false);
    expect(verifyWebhookSignature(body, signWebhookBody(body, secret, now + 3600), secret, now).ok).toBe(false);
  });
  it("header жоқ / бұзылған / секрет жоқ", () => {
    expect(verifyWebhookSignature(body, null, secret, now)).toEqual({ ok: false, reason: "bad_header" });
    expect(verifyWebhookSignature(body, "time=abc,sig1=zz", secret, now)).toEqual({ ok: false, reason: "bad_header" });
    expect(verifyWebhookSignature(body, signWebhookBody(body, secret, now), "", now)).toEqual({ ok: false, reason: "missing_secret" });
    expect(parseWebhookSignature("sig1=" + "a".repeat(64))).toBeNull();
  });
});
