import { describe, expect, it } from "vitest";

import { detectImageType, ownAvatarPath } from "@/lib/images";
import { initials } from "@/lib/initials";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("detectImageType", () => {
  it("detects JPEG, PNG and WebP by their signatures", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(detectImageType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38))).toBe(
      "image/webp",
    );
  });

  it("rejects everything else, even when it is named like an image", () => {
    expect(detectImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(detectImageType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20))).toBeNull(); // RIFF AVI
    expect(detectImageType(bytes())).toBeNull();
  });
});

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("Nodira Karimova")).toBe("NK");
    expect(initials("  oʻtkir  ")).toBe("O");
    expect(initials("Шахноза Юсупова Тест")).toBe("ШЮ");
  });

  it("falls back to a question mark", () => {
    expect(initials("   ")).toBe("?");
  });
});

describe("ownAvatarPath", () => {
  const base = "https://abc.supabase.co";
  const user = "6c686319-8db9-49df-8443-74a57091b3ce";

  it("returns the storage path of the user's own avatar", () => {
    expect(ownAvatarPath(`${base}/storage/v1/object/public/avatars/${user}/a.webp`, `${base}/`, user)).toBe(
      `${user}/a.webp`,
    );
  });

  it("ignores other users' files, other buckets, other hosts and traversal", () => {
    expect(ownAvatarPath(`${base}/storage/v1/object/public/avatars/someone-else/a.webp`, base, user)).toBeNull();
    expect(ownAvatarPath(`${base}/storage/v1/object/public/other/${user}/a.webp`, base, user)).toBeNull();
    expect(
      ownAvatarPath(`https://evil.example/storage/v1/object/public/avatars/${user}/a.webp`, base, user),
    ).toBeNull();
    expect(ownAvatarPath(`${base}/storage/v1/object/public/avatars/${user}/../x/a.webp`, base, user)).toBeNull();
    expect(ownAvatarPath(null, base, user)).toBeNull();
  });
});
