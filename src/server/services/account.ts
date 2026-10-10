import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import type { Database } from "@/types/database";

/**
 * Account data rights (security addendum 5.10, DECISIONS.md D76): a JSON copy of everything the
 * user wrote or chose, and deletion of the account with all of it.
 */

/** Everything stored about the signed-in user, read through RLS (their own rows only). */
export async function exportMyData(userId: string) {
  const supabase = await createClient();
  const own = async <T>(query: PromiseLike<{ data: T | null; error: { code?: string } | null }>) => {
    const { data, error } = await query;
    if (error) throw error;
    return data;
  };
  const [
    profile,
    resources,
    comments,
    ratings,
    likes,
    saves,
    followedUsers,
    followedTopics,
    reports,
    appeals,
    notifications,
  ] = await Promise.all([
    own(
      supabase
        .from("profiles")
        .select(
          "username, display_name, bio, university, field_of_study, role, trust_level, is_banned, banned_until, created_at",
        )
        .eq("id", userId)
        .maybeSingle(),
    ),
    own(
      supabase
        .from("resources")
        .select("slug, title, url, type, language, price, level, summary, for_whom, author_review, status, created_at")
        .eq("author_id", userId),
    ),
    own(supabase.from("comments").select("resource_id, body, status, created_at").eq("author_id", userId)),
    own(supabase.from("resource_ratings").select("resource_id, stars, review_text, created_at").eq("user_id", userId)),
    own(supabase.from("resource_likes").select("resource_id, created_at").eq("user_id", userId)),
    own(supabase.from("resource_saves").select("resource_id, created_at").eq("user_id", userId)),
    own(supabase.from("follows_users").select("followed_id, created_at").eq("follower_id", userId)),
    own(supabase.from("follows_topics").select("topic_id, created_at").eq("user_id", userId)),
    own(
      supabase
        .from("reports")
        .select("target_type, target_id, reason, details, status, created_at")
        .eq("reporter_id", userId),
    ),
    own(
      supabase
        .from("appeals")
        .select("target_type, target_id, message, status, response, created_at")
        .eq("user_id", userId),
    ),
    own(supabase.from("notifications").select("kind, target_type, target_id, rule, message, until, created_at")),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    profile,
    resources,
    comments,
    ratings,
    likes,
    saves,
    followedUsers,
    followedTopics,
    reports,
    appeals,
    notifications,
  };
}

/** Checks the password without touching the current session's cookies. */
export async function passwordMatches(email: string, password: string): Promise<boolean> {
  const env = getPublicEnv();
  const client = createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (!error && data.session) await client.auth.signOut();
  return !error;
}

/**
 * Deletes the auth user; the database removes the profile and, through it, the user's cards,
 * comments, ratings, likes, saves, follows, appeals and notifications. Reports they filed stay
 * without a name; the audit log keeps moderation actions without the actor; severe-incident evidence
 * is kept (DECISIONS.md D76).
 */
export async function deleteAccount(userId: string) {
  const { error } = await createAdminClient().auth.admin.deleteUser(userId);
  if (error) throw new Error(`deleteUser failed (${error.status ?? "no status"})`);
}
