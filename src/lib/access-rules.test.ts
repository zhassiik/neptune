import { describe, expect, it } from "vitest";
import { evaluateCourseAccess } from "./access-rules";

const open = { status: "published", access_mode: "open" };
const paid = { status: "published", access_mode: "enrolled" };

describe("evaluateCourseAccess", () => {
  it("әкімші әрқашан көреді", () => {
    expect(evaluateCourseAccess({ loggedIn: true, isAdmin: true, course: { status: "draft", access_mode: "enrolled" }, enrolled: false }).allowed).toBe(true);
  });
  it("жүйеге кірмеген — рұқсат жоқ", () => {
    expect(evaluateCourseAccess({ loggedIn: false, isAdmin: false, course: open, enrolled: false })).toEqual({ allowed: false, reason: "anonymous" });
  });
  it("ашық курс — барлық тіркелген оқушыға", () => {
    expect(evaluateCourseAccess({ loggedIn: true, isAdmin: false, course: open, enrolled: false })).toEqual({ allowed: true, reason: "open" });
  });
  it("ақылы курс — тек рұқсат берілгенге", () => {
    expect(evaluateCourseAccess({ loggedIn: true, isAdmin: false, course: paid, enrolled: false })).toEqual({ allowed: false, reason: "not_enrolled" });
    expect(evaluateCourseAccess({ loggedIn: true, isAdmin: false, course: paid, enrolled: true })).toEqual({ allowed: true, reason: "enrolled" });
  });
  it("жарияланбаған курс — оқушыға жабық", () => {
    expect(evaluateCourseAccess({ loggedIn: true, isAdmin: false, course: { status: "coming_soon", access_mode: "open" }, enrolled: true }).reason).toBe("not_published");
  });
});
