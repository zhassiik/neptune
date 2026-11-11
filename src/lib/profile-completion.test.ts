import { describe, expect, it } from "vitest";
import { needsContacts, profileCompletionRedirect } from "./profile-completion";

describe("needsContacts", () => {
  it("тек телефоны жоқ оқушыдан сұрайды", () => {
    expect(needsContacts({ role: "student", phone: null, parent_phone: "+77001234567" })).toBe(true);
    expect(needsContacts({ role: "student", phone: "+77001234567", parent_phone: null })).toBe(true);
    expect(needsContacts({ role: "student", phone: "+77001234567", parent_phone: "+77017654321" })).toBe(false);
  });

  it("әкімші, куратор және миграцияға дейінгі профиль — сұрамаймыз", () => {
    expect(needsContacts({ role: "admin", phone: null, parent_phone: null })).toBe(false);
    expect(needsContacts({ role: "curator", phone: null, parent_phone: null })).toBe(false);
    expect(needsContacts({ role: "student" })).toBe(false);
    expect(needsContacts(null)).toBe(false);
  });
});

describe("profileCompletionRedirect", () => {
  it("кез келген беттен профильге, қайтатын жолымен", () => {
    expect(profileCompletionRedirect("/courses/tangy-200")).toBe("/cabinet/profile?complete=1&next=%2Fcourses%2Ftangy-200");
  });

  it("профиль, кіру және тіркелу беттерінде қала береді", () => {
    expect(profileCompletionRedirect("/cabinet/profile")).toBeNull();
    expect(profileCompletionRedirect("/login")).toBeNull();
    expect(profileCompletionRedirect("/register")).toBeNull();
  });
});
