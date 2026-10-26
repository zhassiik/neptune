import { afterEach, describe, expect, it, vi } from "vitest";
import { uuid } from "./utils";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuid", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("crypto.randomUUID бар болса — соны қолданады", () => {
    expect(uuid()).toMatch(V4);
  });

  it("HTTP (қауіпсіз емес) ортада randomUUID жоқ болса да жарамды UUID береді", () => {
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: real.getRandomValues.bind(real) });
    const ids = new Set(Array.from({ length: 100 }, () => uuid()));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(V4);
  });

  it("crypto мүлдем жоқ болса да жұмыс істейді", () => {
    vi.stubGlobal("crypto", undefined);
    expect(uuid()).toMatch(V4);
  });
});

import { humanizeError } from "./utils";

describe("humanizeError", () => {
  it("migration іске қосылмағанда түсінікті хабарлама береді", () => {
    expect(humanizeError({ message: "column courses_1.access_mode does not exist" })).toMatch(/migration/);
    expect(humanizeError({ message: "Could not find the 'video_provider' column of 'test_variants' in the schema cache" })).toMatch(/migration/);
  });
});
