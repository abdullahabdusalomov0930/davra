import "server-only";

import { cache } from "react";

import { getPublicEnv } from "@/lib/env";
import { AVATAR_EXTENSIONS, type AvatarType, ownAvatarPath } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";
import type { ProfileData } from "@/lib/validators";
import type { ActionResult } from "@/lib/action-result";

const PUBLIC_PROFILE_COLUMNS =
  "id, username, display_name, avatar_url, bio, university, field_of_study, role, is_banned, created_at" as const;

const AVATAR_BUCKET = "avatars";

/** Public profile by username (case-insensitive), or null. Readable by guests (RLS). Cached per request. */
export const getPublicProfile = cache(async (username: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
});

export type PublicProfile = NonNullable<Awaited<ReturnType<typeof getPublicProfile>>>;

/**
 * Saves the signed-in user's profile. Runs as that user, so RLS and the guard trigger apply:
 * banned users get "forbidden", and the database has the final word on username rules.
 */
export async function updateProfile(userId: string, input: ProfileData): Promise<ActionResult<"username">> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: input.displayName,
      username: input.username,
      bio: input.bio,
      university: input.university,
      field_of_study: input.fieldOfStudy,
    })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error?.code === "23505" && error.message.includes("profiles_username_key")) {
    return { ok: false, error: "invalidInput", fieldErrors: { username: "usernameTaken" } };
  }
  if (error?.code === "23514" && error.message.includes("profiles_username")) {
    return { ok: false, error: "invalidInput", fieldErrors: { username: "usernameReserved" } };
  }
  if (error) {
    console.error("updateProfile failed", { code: error.code });
    return { ok: false, error: "unknown" };
  }
  // No row back means RLS filtered it out: the account is banned.
  if (!data) return { ok: false, error: "forbidden" };
  return { ok: true };
}

/**
 * Uploads a new avatar under a fresh name (so CDN caches never serve the old one), points the
 * profile at it and then deletes the previous file.
 */
export async function replaceAvatar(
  userId: string,
  image: { bytes: Uint8Array; type: AvatarType },
  previousUrl: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  const storage = supabase.storage.from(AVATAR_BUCKET);
  const path = `${userId}/${crypto.randomUUID()}.${AVATAR_EXTENSIONS[image.type]}`;

  const upload = await storage.upload(path, image.bytes, {
    contentType: image.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (upload.error) {
    console.error("Avatar upload failed", { message: upload.error.message });
    return { ok: false, error: "uploadFailed" };
  }

  const publicUrl = storage.getPublicUrl(path).data.publicUrl;
  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    await storage.remove([path]);
    if (error) console.error("Avatar profile update failed", { code: error.code });
    return { ok: false, error: error ? "unknown" : "forbidden" };
  }

  await removeOwnAvatarFile(userId, previousUrl);
  return { ok: true };
}

export async function clearAvatar(userId: string, previousUrl: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Avatar removal failed", { code: error.code });
    return { ok: false, error: "unknown" };
  }
  if (!data) return { ok: false, error: "forbidden" };

  await removeOwnAvatarFile(userId, previousUrl);
  return { ok: true };
}

/** Best effort: a leftover file only costs storage, so failures are logged, not surfaced. */
async function removeOwnAvatarFile(userId: string, url: string | null) {
  const path = ownAvatarPath(url, getPublicEnv().NEXT_PUBLIC_SUPABASE_URL, userId);
  if (!path) return;

  const supabase = await createClient();
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) console.error("Old avatar cleanup failed", { message: error.message });
}
