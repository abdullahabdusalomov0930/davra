import "server-only";

import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";

type FollowTarget = { kind: "user"; id: string } | { kind: "topic"; id: string };

/** Whether the signed-in user follows this person or topic (follows are private, D21). */
export async function isFollowing(viewerId: string, target: FollowTarget): Promise<boolean> {
  const supabase = await createClient();
  const query =
    target.kind === "user"
      ? supabase
          .from("follows_users")
          .select("followed_id", { count: "exact", head: true })
          .eq("follower_id", viewerId)
          .eq("followed_id", target.id)
      : supabase
          .from("follows_topics")
          .select("topic_id", { count: "exact", head: true })
          .eq("user_id", viewerId)
          .eq("topic_id", target.id);
  const { count, error } = await query;
  if (error) throw error;
  return Boolean(count);
}

/** Follows or unfollows. Idempotent, like likes and saves. */
export async function setFollow(viewerId: string, target: FollowTarget, follow: boolean): Promise<ActionResult> {
  const supabase = await createClient();

  if (follow) {
    const { error } =
      target.kind === "user"
        ? await supabase.from("follows_users").insert({ followed_id: target.id })
        : await supabase.from("follows_topics").insert({ topic_id: target.id });
    if (!error || error.code === "23505") return { ok: true };
    // Following yourself (check constraint) or a banned account (RLS).
    if (error.code === "23514" || error.code === "42501") return { ok: false, error: "forbidden" };
    if (error.code === "23503") return { ok: false, error: "notFound" };
    console.error("follow failed", { code: error.code });
    return { ok: false, error: "unknown" };
  }

  const { data, error } =
    target.kind === "user"
      ? await supabase
          .from("follows_users")
          .delete()
          .eq("follower_id", viewerId)
          .eq("followed_id", target.id)
          .select("followed_id")
      : await supabase
          .from("follows_topics")
          .delete()
          .eq("user_id", viewerId)
          .eq("topic_id", target.id)
          .select("topic_id");
  if (error) {
    console.error("unfollow failed", { code: error.code });
    return { ok: false, error: "unknown" };
  }
  if (data.length > 0) return { ok: true };
  // Nothing deleted: not followed in the first place, or RLS refused (banned account).
  return (await isFollowing(viewerId, target)) ? { ok: false, error: "forbidden" } : { ok: true };
}

/** The people and topics the signed-in user follows, for /obunalarim. */
export async function getFollowing(viewerId: string) {
  const supabase = await createClient();
  const [users, topics] = await Promise.all([
    supabase
      .from("follows_users")
      .select("followed:profiles!follows_users_followed_id_fkey (id, username, display_name, avatar_url)")
      .eq("follower_id", viewerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("follows_topics")
      .select("topic:topics (id, slug, name_uz)")
      .eq("user_id", viewerId)
      .order("created_at", { ascending: false }),
  ]);
  if (users.error) throw users.error;
  if (topics.error) throw topics.error;
  return {
    users: users.data.flatMap((row) => row.followed ?? []),
    topics: topics.data.flatMap((row) => row.topic ?? []),
  };
}
