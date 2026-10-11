import { describe, expect, it } from "vitest";

import { newPasswordSchema, signUpSchema } from "@/lib/validators";
import { containsPersonalInfo, isCommonPassword } from "@/lib/validators/password";

describe("password policy", () => {
  it("needs at least 10 characters", () => {
    expect(newPasswordSchema.safeParse("qisqa-123").success).toBe(false);
    expect(newPasswordSchema.safeParse("yashil-olma-2026").success).toBe(true);
  });

  it.each(["1234567890", "qwertyuiop", "Password123", "aaaaaaaaaa", "abcdefghij", "9876543210", "uzbekistan"])(
    "refuses the common password %s",
    (password) => {
      expect(isCommonPassword(password)).toBe(true);
    },
  );

  it("refuses passwords with the username or the e-mail name", () => {
    expect(containsPersonalInfo("nodira2026!", { username: "nodira" })).toBe(true);
    expect(containsPersonalInfo("Karimova-parol", { email: "karimova@example.com" })).toBe(true);
    expect(containsPersonalInfo("yashil-olma-2026", { username: "nodira", email: "n@example.com" })).toBe(false);
    const result = signUpSchema.safeParse({
      displayName: "Nodira",
      username: "nodira",
      email: "nodira@example.com",
      password: "nodira-parol-1",
    });
    expect(result.success ? [] : result.error.issues.map((issue) => issue.message)).toEqual(["passwordPersonal"]);
  });
});
