import "server-only";

import { cache } from "react";

import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import type { AppealData, AppealInput } from "@/lib/validators";

// In-app notices (no e-mail): hidden or restored content, bans, warnings, appeal decisions. Written by
// database triggers and the moderation functions; users read and mark their own (RLS).

export async function listNotifications(limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, target_type, target_id, rule, message, until, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export type Notification = Awaited<ReturnType<typeof listNotifications>>[number];

/** Unread notices of the signed-in user, for the header. Cached per request. */
export const countUnreadNotifications = cache(async () => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
});

export async function markNotificationsRead() {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
}

/** Targets the signed-in user already appealed ("resource:<id>", "ban:<id>"…): one appeal each. */
export async function listAppealedTargets() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("appeals").select("target_type, target_id");
  if (error) throw error;
  return new Set(data.map((appeal) => `${appeal.target_type}:${appeal.target_id}`));
}

export async function createAppeal(data: AppealData): Promise<ActionResult<keyof AppealInput>> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("appeals")
    .insert({ target_type: data.targetType, target_id: data.targetId, message: data.message });
  if (!error) return { ok: true };
  if (error.code === "23505") return { ok: false, error: "alreadyAppealed" };
  // Not hidden (any more), not theirs, or not banned.
  if (error.code === "23503" || error.code === "42501") return { ok: false, error: "nothingToAppeal" };
  console.error("appeal insert failed", { code: error.code });
  return { ok: false, error: "unknown" };
}

/** The signed-in user's ban, with the reason only they and staff may read. */
export async function getMyBan(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ban_details", { user_id: userId }).maybeSingle();
  if (error) throw error;
  return data?.is_banned ? data : null;
}
