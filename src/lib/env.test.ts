import { describe, expect, it } from "vitest";
import { serviceKeyProblem } from "./env";

const jwt = (role: string) => `x.${Buffer.from(JSON.stringify({ role, ref: "abc" })).toString("base64url")}.sig`;

describe("serviceKeyProblem", () => {
  it("жарамды кілттер", () => {
    expect(serviceKeyProblem("sb_secret_abc123")).toBeNull();
    expect(serviceKeyProblem(jwt("service_role"))).toBeNull();
  });
  it("қате кілттерді анықтайды", () => {
    expect(serviceKeyProblem(undefined)).toMatch(/орнатылмаған/);
    expect(serviceKeyProblem("your-service-role-key")).toMatch(/жарамсыз/);
    expect(serviceKeyProblem("sb_publishable_abc")).toMatch(/publishable/);
    expect(serviceKeyProblem(jwt("anon"))).toMatch(/«anon»/);
  });
});
