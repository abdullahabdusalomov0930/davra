import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { ProfileData, ProfileInput } from "@/lib/validators";
import type { ActionResult } from "@/lib/action-result";
import { screenSubmission } from "@/server/safety/screen";

const PUBLIC_PROFILE_COLUMNS =
  "id, username, display_name, bio, university, field_of_study, role, is_banned, created_at" as const;

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
 * Saves the signed-in user's profile after the safety check (D64). Runs as that user, so RLS and the
 * guard trigger apply: banned users get "forbidden", and the database has the final word on username
 * rules.
 */
export async function updateProfile(userId: string, input: ProfileData): Promise<ActionResult<keyof ProfileInput>> {
  const screening = await screenSubmission(userId, { kind: "profile", ...input });
  if (!screening.ok) return { ok: false, error: "invalidInput", fieldErrors: screening.fieldErrors };

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
