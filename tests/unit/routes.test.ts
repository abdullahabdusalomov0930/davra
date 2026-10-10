import { describe, expect, it } from "vitest";

import { canonicalProfilePath, isGuestOnlyPath, isProtectedPath, routes } from "@/lib/routes";

describe("isProtectedPath", () => {
  it("protects the settings page and anything below it", () => {
    expect(isProtectedPath("/sozlamalar")).toBe(true);
    expect(isProtectedPath("/sozlamalar/xavfsizlik")).toBe(true);
  });

  it("protects creating and editing resources, but not reading them", () => {
    expect(isProtectedPath("/yangi-resurs")).toBe(true);
    expect(isProtectedPath("/resurs/python-asoslari/tahrirlash")).toBe(true);
    expect(isProtectedPath("/resurs/python-asoslari")).toBe(false);
    expect(isProtectedPath("/resurs/tahrirlash")).toBe(false);
  });

  it("leaves public pages and look-alike paths alone", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/kirish")).toBe(false);
    expect(isProtectedPath("/sozlamalarim")).toBe(false);
    expect(isProtectedPath("/u/nodira")).toBe(false);
  });
});

describe("routes.profile", () => {
  it("builds profile URLs", () => {
    expect(routes.profile("nodira_01")).toBe("/u/nodira_01");
  });

  it("builds resource URLs", () => {
    expect(routes.resource("python-asoslari")).toBe("/resurs/python-asoslari");
    expect(routes.editResource("python-asoslari")).toBe("/resurs/python-asoslari/tahrirlash");
  });
});

describe("isGuestOnlyPath", () => {
  it("covers sign-in and sign-up only", () => {
    expect(isGuestOnlyPath("/kirish")).toBe(true);
    expect(isGuestOnlyPath("/royxatdan-otish")).toBe(true);
    expect(isGuestOnlyPath("/parolni-tiklash/yangi")).toBe(false);
    expect(isGuestOnlyPath("/email-tasdiqlash")).toBe(false);
  });
});

describe("canonicalProfilePath", () => {
  it("lower-cases profile URLs", () => {
    expect(canonicalProfilePath("/u/Nodira_01")).toBe("/u/nodira_01");
    expect(canonicalProfilePath("/u/nodira/")).toBe("/u/nodira");
  });

  it("returns null when already canonical or not a profile URL", () => {
    expect(canonicalProfilePath("/u/nodira")).toBeNull();
    expect(canonicalProfilePath("/u/Nodira/extra")).toBeNull();
    expect(canonicalProfilePath("/Sozlamalar")).toBeNull();
  });
});
