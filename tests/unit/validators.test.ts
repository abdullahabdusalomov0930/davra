import { describe, expect, it } from "vitest";

import { profileSchema, RESERVED_USERNAMES, signInSchema, signUpSchema, usernameSchema } from "@/lib/validators";

function firstError(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? undefined : result.error?.issues[0]?.message;
}

describe("usernameSchema", () => {
  it("trims and lower-cases", () => {
    expect(usernameSchema.parse("  Nodira_01 ")).toBe("nodira_01");
  });

  it.each(["ab", "a".repeat(31), "nodira.k", "nodira-k", "nodira k", "oʻgʻil"])("rejects %j", (value) => {
    expect(firstError(usernameSchema.safeParse(value))).toBe("usernameFormat");
  });

  it("rejects reserved names in any case", () => {
    expect(firstError(usernameSchema.safeParse("Admin"))).toBe("usernameReserved");
    expect(firstError(usernameSchema.safeParse("davra"))).toBe("usernameReserved");
    expect(firstError(usernameSchema.safeParse("Davracha"))).toBe("usernameReserved");
  });
});

describe("signUpSchema", () => {
  const valid = {
    displayName: "  Nodira Karimova ",
    username: "Nodira",
    email: "  Nodira@Misol.UZ ",
    password: "maxfiy-parol",
  };

  it("normalizes the input", () => {
    expect(signUpSchema.parse(valid)).toEqual({
      displayName: "Nodira Karimova",
      username: "nodira",
      email: "nodira@misol.uz",
      password: "maxfiy-parol",
    });
  });

  it("requires 8 to 72 characters in a new password", () => {
    expect(firstError(signUpSchema.safeParse({ ...valid, password: "1234567" }))).toBe("passwordTooShort");
    expect(firstError(signUpSchema.safeParse({ ...valid, password: "x".repeat(73) }))).toBe("passwordTooLong");
  });

  it("rejects invalid emails and empty names", () => {
    expect(firstError(signUpSchema.safeParse({ ...valid, email: "nodira@" }))).toBe("emailInvalid");
    expect(firstError(signUpSchema.safeParse({ ...valid, displayName: "   " }))).toBe("displayNameRequired");
  });
});

describe("signInSchema", () => {
  it("accepts any non-empty password (old passwords may be shorter)", () => {
    expect(signInSchema.safeParse({ email: "a@b.uz", password: "123456" }).success).toBe(true);
    expect(firstError(signInSchema.safeParse({ email: "a@b.uz", password: "" }))).toBe("required");
  });
});

describe("profileSchema", () => {
  const valid = { displayName: "Nodira", username: "nodira", bio: "", university: "  TATU ", fieldOfStudy: " " };

  it("stores empty optional fields as null and trims the rest", () => {
    expect(profileSchema.parse(valid)).toEqual({
      displayName: "Nodira",
      username: "nodira",
      bio: null,
      university: "TATU",
      fieldOfStudy: null,
    });
  });

  it("limits the bio to 300 characters", () => {
    expect(firstError(profileSchema.safeParse({ ...valid, bio: "xy".repeat(151) }))).toBe("bioTooLong");
  });
});

describe("RESERVED_USERNAMES", () => {
  it("matches the list the database enforces", async () => {
    const { readdir, readFile } = await import("node:fs/promises");
    // The newest migration that (re)defines the function is the one in force.
    const files = (await readdir("supabase/migrations")).sort().reverse();
    let list = "";
    for (const file of files) {
      const sql = await readFile(`supabase/migrations/${file}`, "utf8");
      if (!sql.includes("function private.is_reserved_username")) continue;
      list = sql.match(/return name = any \(array\[([\s\S]*?)\]\)/)?.[1] ?? "";
      break;
    }
    const fromSql = [...list.matchAll(/'([a-z0-9_]+)'/g)].map((match) => match[1]).sort();
    expect(fromSql).toEqual([...RESERVED_USERNAMES].sort());
  });
});
