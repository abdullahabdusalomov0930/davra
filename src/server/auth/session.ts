import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type Viewer = {
  id: string;
  email: string | null;
  /** When the user last proved who they are (password, e-mail link), in seconds since 1970. */
  authenticatedAt: number | null;
};

/**
 * The signed-in user for this request, read from the verified session JWT (`getClaims`), or null.
 * Cached per request, so layouts, pages and actions can all call it.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  // `amr` lists how and when the session was authenticated; refreshing the token does not change it.
  const methods = Array.isArray(claims.amr) ? (claims.amr as { timestamp?: unknown }[]) : [];
  const times = methods.map((method) => method.timestamp).filter((time): time is number => typeof time === "number");
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    authenticatedAt: times.length > 0 ? Math.max(...times) : null,
  };
});

const VIEWER_PROFILE_COLUMNS =
  "id, username, display_name, bio, university, field_of_study, role, is_banned, banned_until, trust_level" as const;

/** The signed-in user's profile, or null when signed out. */
export const getViewerProfile = cache(async () => {
  const viewer = await getViewer();
  if (!viewer) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(VIEWER_PROFILE_COLUMNS)
    .eq("id", viewer.id)
    .maybeSingle();
  if (error) throw error;
  return data ? { ...data, email: viewer.email } : null;
});

export type ViewerProfile = NonNullable<Awaited<ReturnType<typeof getViewerProfile>>>;

/** For pages that need a signed-in user: sends everyone else to sign-in and back here afterwards. */
export async function requireViewer(returnTo: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/kirish?next=${encodeURIComponent(returnTo)}`);
  return viewer;
}

/** The viewer's profile if they are staff (a moderator or admin who is not banned), else null. */
export async function getStaffProfile(): Promise<ViewerProfile | null> {
  const profile = await getViewerProfile();
  return profile && !profile.is_banned && profile.role !== "user" ? profile : null;
}

/**
 * For the moderation panel: staff only. Everyone else gets a 404, so the panel does not advertise
 * itself. RLS still guards every query and action.
 */
export async function requireStaff(returnTo: string): Promise<ViewerProfile> {
  await requireViewer(returnTo);
  const profile = await getStaffProfile();
  if (!profile) notFound();
  return profile;
}

const RECENT_SIGN_IN_SECONDS = 15 * 60;

/** The viewer signed in (or confirmed an e-mail link) in the last 15 minutes. */
export async function hasRecentSignIn(): Promise<boolean> {
  const viewer = await getViewer();
  return Boolean(viewer?.authenticatedAt && Date.now() / 1000 - viewer.authenticatedAt < RECENT_SIGN_IN_SECONDS);
}
