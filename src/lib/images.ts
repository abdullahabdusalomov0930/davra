export const AVATAR_SIZE = 256;
/** Matches the `avatars` bucket limit. The browser resizes first, so real uploads are far smaller. */
export const AVATAR_MAX_BYTES = 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AvatarType = (typeof AVATAR_TYPES)[number];

export const AVATAR_EXTENSIONS: Record<AvatarType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Detects JPEG, PNG and WebP from the file's first bytes. The declared MIME type comes from the
 * client and cannot be trusted on its own.
 */
export function detectImageType(bytes: Uint8Array): AvatarType | null {
  const startsWith = (signature: number[], offset = 0) =>
    bytes.length >= offset + signature.length && signature.every((byte, index) => bytes[offset + index] === byte);

  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // "RIFF" <size> "WEBP"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

/**
 * Storage path of an avatar if `url` is a public URL in this project's `avatars` bucket and inside
 * the user's own folder; otherwise null (old external URLs are never deleted from Storage).
 */
export function ownAvatarPath(url: string | null, supabaseUrl: string, userId: string): string | null {
  if (!url) return null;
  const prefix = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/avatars/`;
  if (!url.startsWith(prefix)) return null;
  const path = decodeURIComponent(url.slice(prefix.length).split(/[?#]/)[0]);
  return path.startsWith(`${userId}/`) && !path.includes("..") ? path : null;
}
