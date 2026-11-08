/**
 * Видео жүктеу API-лерінің құқық және қауіпсіздік тесттері.
 * Supabase және Cloudflare — жадтағы жалған нұсқалар; route handler-лер нақты код.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/* ------------------------------ жалған дерекқор ------------------------------ */

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
let canManage = true;

function builder(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let op: "select" | "update" | "delete" | "insert" = "select";
  let patch: Row = {};
  let head = false;
  let limitN = Infinity;
  const rows = () => (db[table] ??= []);
  const matched = () => rows().filter((r) => filters.every((f) => f(r)));
  const run = () => {
    if (op === "update") {
      const m = matched();
      m.forEach((r) => Object.assign(r, patch, { updated_at: new Date().toISOString() }));
      return { data: m, error: null };
    }
    if (op === "delete") {
      db[table] = rows().filter((r) => !filters.every((f) => f(r)));
      return { data: null, error: null };
    }
    const m = matched().slice(0, limitN);
    return head ? { data: null, count: m.length, error: null } : { data: m, count: m.length, error: null };
  };
  const b = {
    select(_cols?: string, opts?: { head?: boolean }) {
      if (opts?.head) head = true;
      return b;
    },
    insert(row: Row | Row[]) {
      const list = Array.isArray(row) ? row : [row];
      list.forEach((r) => rows().push({ created_at: new Date().toISOString(), replaced_at: null, deleted_at: null, error_message: null, duration_seconds: null, ...r }));
      op = "insert";
      return Promise.resolve({ data: null, error: null });
    },
    update(p: Row) {
      op = "update";
      patch = p;
      return b;
    },
    delete() {
      op = "delete";
      return b;
    },
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
    neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), b),
    in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), b),
    is: (k: string, v: null) => (filters.push((r) => (r[k] ?? null) === v), b),
    not: (k: string) => (filters.push((r) => (r[k] ?? null) !== null), b),
    gte: (k: string, v: string) => (filters.push((r) => String(r[k]) >= v), b),
    order: () => b,
    limit: (n: number) => ((limitN = n), b),
    maybeSingle: () => Promise.resolve({ data: run().data?.[0] ?? null, error: null }),
    single: () => Promise.resolve({ data: run().data?.[0] ?? null, error: null }),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
  };
  return b;
}

const adminClient = {
  from: builder,
  rpc: vi.fn(async (name: string, args: { p_uid: string; p_duration_seconds: number | null }) => {
    if (name !== "stream_video_mark_ready") throw new Error(name);
    const v = db.stream_videos.find((r) => r.cloudflare_uid === args.p_uid)!;
    if (["ready", "error"].includes(String(v.status))) return { data: [], error: null };
    v.status = "ready";
    const lesson = db.test_variants.find((r) => r.id === v.variant_id)!;
    const old = lesson.cloudflare_video_uid as string | null;
    Object.assign(lesson, { cloudflare_video_uid: args.p_uid, video_provider: "cloudflare", video_status: "ready" });
    if (old && old !== args.p_uid) db.stream_videos.filter((r) => r.cloudflare_uid === old).forEach((r) => (r.replaced_at = new Date().toISOString()));
    return { data: [{ old_uid: old !== args.p_uid ? old : null, applied: true }], error: null };
  }),
};

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => adminClient, ServerConfigError: class extends Error {} }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: async () => ({ data: canManage, error: null }) }),
}));

/* ------------------------------ пайдаланушы ------------------------------ */

let currentUser: { id: string; email: string; profile: { role: string } | null } | null = null;
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => currentUser }));

/* ------------------------------ жалған Cloudflare ------------------------------ */

const API_TOKEN = "cf-secret-api-token-1234567890";
const NEW_UID = "a".repeat(32);
const OLD_UID = "b".repeat(32);
const cf = {
  createDirectTusUpload: vi.fn(async () => ({ uploadUrl: `https://edge-production.gateway.api.cloudflare.com/client/v4/accounts/x/media/${NEW_UID}?tusv2=true`, uid: NEW_UID })),
  configureUploadedVideo: vi.fn(async () => undefined),
  deleteStreamVideo: vi.fn(async () => undefined),
  getStreamVideoState: vi.fn(async () => ({
    uid: NEW_UID,
    state: "ready",
    readyToStream: true,
    durationSeconds: 600,
    requireSignedURLs: true,
    allowedOrigins: [] as string[],
    errReasonCode: null as string | null,
  })),
};
vi.mock("@/lib/cloudflare/stream", async () => {
  class StreamConfigError extends Error {}
  class StreamNotFoundError extends StreamConfigError {}
  class StreamUploadError extends Error {}
  return { ...cf, StreamConfigError, StreamNotFoundError, StreamUploadError };
});

const { POST: createUpload } = await import("@/app/api/admin/stream/uploads/route");
const videoRoute = await import("@/app/api/admin/stream/videos/[videoId]/route");
const { POST: webhook } = await import("@/app/api/webhooks/cloudflare-stream/route");
const { signWebhookBody } = await import("./webhook");

/* ------------------------------ көмекшілер ------------------------------ */

const COURSE = "11111111-1111-4111-8111-111111111111";
const LESSON = "22222222-2222-4222-8222-222222222222";
const TEACHER = "33333333-3333-4333-8333-333333333333";
const STUDENT = "44444444-4444-4444-8444-444444444444";
const ADMIN = "55555555-5555-4555-8555-555555555555";

const as = (id: string, role: string) => (currentUser = { id, email: `${role}@x.kz`, profile: { role } });

function tusRequest(opts: { variantId?: string; size?: number; name?: string; type?: string; replace?: boolean; extra?: string } = {}) {
  const meta = `filename ${Buffer.from(opts.name ?? "Талдау.mp4").toString("base64")},filetype ${Buffer.from(opts.type ?? "video/mp4").toString("base64")}`;
  const qs = new URLSearchParams({ variantId: opts.variantId ?? LESSON, ...(opts.replace ? { replace: "1" } : {}) });
  return new Request(`http://localhost/api/admin/stream/uploads?${qs}${opts.extra ?? ""}`, {
    method: "POST",
    headers: { "Tus-Resumable": "1.0.0", "Upload-Length": String(opts.size ?? 50_000_000), "Upload-Metadata": meta },
  });
}

async function responseText(res: Response) {
  return [...res.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n") + "\n" + (await res.clone().text());
}

beforeEach(() => {
  process.env.CLOUDFLARE_API_TOKEN = API_TOKEN;
  process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET = "whsec-test-123";
  canManage = true;
  currentUser = null;
  db.test_variants = [{ id: LESSON, course_id: COURSE, title: "Контекст", position: 1, video_provider: "url", video_url: null, cloudflare_video_uid: null, video_status: null }];
  db.stream_videos = [];
  Object.values(cf).forEach((f) => f.mockClear());
});

/* ------------------------------ тесттер ------------------------------ */

describe("POST /api/admin/stream/uploads — құқық", () => {
  it("кірмеген пайдаланушы → 401", async () => {
    const res = await createUpload(tusRequest());
    expect(res.status).toBe(401);
    expect(cf.createDirectTusUpload).not.toHaveBeenCalled();
  });

  it("оқушы upload URL ала алмайды → 403", async () => {
    as(STUDENT, "student");
    const res = await createUpload(tusRequest());
    expect(res.status).toBe(403);
    expect(res.headers.get("location")).toBeNull();
    expect(cf.createDirectTusUpload).not.toHaveBeenCalled();
  });

  it("әкімші болса да, курсқа құқық жоқ болса (дерекқор тексерісі) → 403", async () => {
    as(ADMIN, "admin");
    canManage = false;
    const res = await createUpload(tusRequest());
    expect(res.status).toBe(403);
    expect(cf.createDirectTusUpload).not.toHaveBeenCalled();
  });

  it("куратор видео жүктей алмайды → 403 (видео — тек әкімші)", async () => {
    as(TEACHER, "curator");
    const res = await createUpload(tusRequest());
    expect(res.status).toBe(403);
    expect(cf.createDirectTusUpload).not.toHaveBeenCalled();
  });

  it("әкімші → 201, UID серверде сақталады, курс клиенттен алынбайды", async () => {
    as(ADMIN, "admin");
    const res = await createUpload(tusRequest({ extra: `&courseId=99999999-9999-4999-8999-999999999999&uploaded_by=${TEACHER}&uid=${OLD_UID}` }));
    expect(res.status).toBe(201);
    expect(res.headers.get("location")).toMatch(/^https:\/\/[^/]*cloudflare\.com\//);
    const id = res.headers.get("x-video-id");
    const row = db.stream_videos.find((r) => r.id === id)!;
    expect(row).toMatchObject({ cloudflare_uid: NEW_UID, course_id: COURSE, variant_id: LESSON, uploaded_by: ADMIN, status: "waiting", original_filename: "Талдау.mp4" });
    expect(cf.configureUploadedVideo).toHaveBeenCalledWith(NEW_UID, expect.objectContaining({ neptune_video_id: id, course_id: COURSE, lesson_id: LESSON, uploaded_by: ADMIN }));
  });

  it("әкімші → 201; API token жауапта жоқ; видео файл сервер арқылы өтпейді", async () => {
    as(ADMIN, "admin");
    const req = tusRequest();
    const res = await createUpload(req);
    expect(res.status).toBe(201);
    expect(req.bodyUsed).toBe(false);
    expect(await responseText(res)).not.toContain(API_TOKEN);
  });
});

describe("POST /api/admin/stream/uploads — тексерулер", () => {
  beforeEach(() => as(ADMIN, "admin"));

  it("видео емес файл → 415, тым үлкен → 413", async () => {
    expect((await createUpload(tusRequest({ name: "notes.pdf", type: "application/pdf" }))).status).toBe(415);
    expect((await createUpload(tusRequest({ size: 31 * 1024 ** 3 }))).status).toBe(413);
    expect((await createUpload(tusRequest({ size: 0 }))).status).toBe(400);
    expect(cf.createDirectTusUpload).not.toHaveBeenCalled();
  });

  it("сабақта видео бар: растаусыз → 409, replace=1 → 201", async () => {
    Object.assign(db.test_variants[0], { video_provider: "cloudflare", cloudflare_video_uid: OLD_UID });
    const res = await createUpload(tusRequest());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("needs_confirm");
    expect((await createUpload(tusRequest({ replace: true }))).status).toBe(201);
    expect(cf.deleteStreamVideo).not.toHaveBeenCalledWith(OLD_UID); // ескі видео әлі өшірілмейді
  });

  it("жиілік шегі → 429", async () => {
    for (let i = 0; i < 12; i++) db.stream_videos.push({ id: `x${i}`, uploaded_by: ADMIN, created_at: new Date().toISOString(), variant_id: "other", status: "error" });
    const res = await createUpload(tusRequest());
    expect(res.status).toBe(429);
  });

  it("қайта басу: алдыңғы аяқталмаған жүктеу тоқтатылады", async () => {
    const first = await createUpload(tusRequest());
    const firstId = first.headers.get("x-video-id");
    cf.createDirectTusUpload.mockResolvedValueOnce({ uploadUrl: "https://upload.cloudflarestream.com/tus/c", uid: "c".repeat(32) });
    await createUpload(tusRequest());
    expect(db.stream_videos.find((r) => r.id === firstId)).toMatchObject({ status: "error" });
    expect(cf.deleteStreamVideo).toHaveBeenCalledWith(NEW_UID);
  });
});

describe("/api/admin/stream/videos/[id]", () => {
  const VID = "66666666-6666-4666-8666-666666666666";
  const ctx = { params: Promise.resolve({ videoId: VID }) };
  beforeEach(() => {
    db.stream_videos.push({ id: VID, cloudflare_uid: NEW_UID, course_id: COURSE, variant_id: LESSON, uploaded_by: TEACHER, original_filename: "a.mp4", size_bytes: 10, status: "processing", created_at: new Date().toISOString() });
  });

  it("401 / 403 (оқушы) / 403 (куратор)", async () => {
    expect((await videoRoute.GET(new Request("http://x"), ctx)).status).toBe(401);
    as(STUDENT, "student");
    expect((await videoRoute.GET(new Request("http://x"), ctx)).status).toBe(403);
    as(TEACHER, "curator");
    expect((await videoRoute.DELETE(new Request("http://x"), ctx)).status).toBe(403);
    expect(cf.deleteStreamVideo).not.toHaveBeenCalled();
  });

  it("processing → ready: сабаққа бекітіледі, ескі видео тек содан кейін өшіріледі", async () => {
    as(ADMIN, "admin");
    Object.assign(db.test_variants[0], { video_provider: "cloudflare", cloudflare_video_uid: OLD_UID });
    db.stream_videos.push({ id: "old", cloudflare_uid: OLD_UID, course_id: COURSE, variant_id: LESSON, status: "ready", created_at: "2026-01-01" });
    cf.getStreamVideoState.mockResolvedValueOnce({ uid: NEW_UID, state: "inprogress", readyToStream: false, durationSeconds: 0, requireSignedURLs: true, allowedOrigins: [], errReasonCode: null });
    const first = await (await videoRoute.GET(new Request("http://x"), ctx)).json();
    expect(first.video.status).toBe("processing");
    expect(cf.deleteStreamVideo).not.toHaveBeenCalled();
    expect(db.test_variants[0].cloudflare_video_uid).toBe(OLD_UID);

    const second = await (await videoRoute.GET(new Request("http://x"), ctx)).json();
    expect(second.video).toMatchObject({ status: "ready", isCurrent: true });
    expect(db.test_variants[0].cloudflare_video_uid).toBe(NEW_UID);
    expect(cf.deleteStreamVideo).toHaveBeenCalledWith(OLD_UID);
  });

  it("Cloudflare өңдеу қатесі → error және түсінікті мәтін", async () => {
    as(ADMIN, "admin");
    cf.getStreamVideoState.mockResolvedValueOnce({ uid: NEW_UID, state: "error", readyToStream: false, durationSeconds: 0, requireSignedURLs: true, allowedOrigins: [], errReasonCode: "ERR_MALFORMED_VIDEO" });
    const body = await (await videoRoute.GET(new Request("http://x"), ctx)).json();
    expect(body.video.status).toBe("error");
    expect(body.video.message).toMatch(/зақымдалған/);
  });

  it("PATCH клиент ready/error қоя алмайды", async () => {
    as(ADMIN, "admin");
    const res = await videoRoute.PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ action: "ready" }) }), ctx);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/webhooks/cloudflare-stream", () => {
  const VID = "77777777-7777-4777-8777-777777777777";
  const payload = JSON.stringify({ uid: NEW_UID, readyToStream: true, status: { state: "ready" } });
  const hook = (body: string, signature: string | null) =>
    webhook(new Request("http://x/api/webhooks/cloudflare-stream", { method: "POST", body, headers: signature ? { "Webhook-Signature": signature } : {} }));

  beforeEach(() => {
    db.stream_videos.push({ id: VID, cloudflare_uid: NEW_UID, course_id: COURSE, variant_id: LESSON, uploaded_by: TEACHER, original_filename: "a.mp4", status: "processing", created_at: new Date().toISOString() });
  });

  it("қолтаңбасыз / жалған қолтаңба → 401, ештеңе өзгермейді", async () => {
    expect((await hook(payload, null)).status).toBe(401);
    expect((await hook(payload, signWebhookBody(payload, "attacker-secret"))).status).toBe(401);
    expect((await hook(payload.replace("ready", "error"), signWebhookBody(payload, "whsec-test-123"))).status).toBe(401);
    expect(db.stream_videos[0].status).toBe("processing");
    expect(cf.getStreamVideoState).not.toHaveBeenCalled();
  });

  it("секрет орнатылмаған → 503 (webhook қабылданбайды)", async () => {
    delete process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
    expect((await hook(payload, signWebhookBody(payload, "whsec-test-123"))).status).toBe(503);
  });

  it("дұрыс қолтаңба → күй Cloudflare API-дан қайта тексеріліп, ready болады", async () => {
    const res = await hook(payload, signWebhookBody(payload, "whsec-test-123"));
    expect(res.status).toBe(200);
    expect(cf.getStreamVideoState).toHaveBeenCalledWith(NEW_UID);
    expect(db.stream_videos[0].status).toBe("ready");
    expect(db.test_variants[0].cloudflare_video_uid).toBe(NEW_UID);
  });

  it("денеде ready деп жазылса да, Cloudflare әлі өңдеп жатса — ready болмайды", async () => {
    cf.getStreamVideoState.mockResolvedValueOnce({ uid: NEW_UID, state: "inprogress", readyToStream: false, durationSeconds: 0, requireSignedURLs: true, allowedOrigins: [], errReasonCode: null });
    await hook(payload, signWebhookBody(payload, "whsec-test-123"));
    expect(db.stream_videos[0].status).toBe("processing");
    expect(db.test_variants[0].cloudflare_video_uid).toBeNull();
  });

  it("сайтқа қатысы жоқ UID → 200 ignored", async () => {
    const other = JSON.stringify({ uid: "d".repeat(32) });
    const res = await hook(other, signWebhookBody(other, "whsec-test-123"));
    expect(await res.json()).toMatchObject({ ok: true, ignored: true });
  });
});
