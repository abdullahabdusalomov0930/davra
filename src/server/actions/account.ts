"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { type DeleteAccountInput, deleteAccountSchema } from "@/lib/validators";
import { recordAuthEvent } from "@/server/auth/events";
import { getViewer, getViewerProfile } from "@/server/auth/session";
import { checkRateLimit } from "@/server/rate-limit";
import { clientIp } from "@/server/request";
import { deleteAccount, exportMyData, passwordMatches } from "@/server/services/account";

import { toFieldErrors } from "./validation";

/** "Maʼlumotlarimni yuklab olish": the user's data as JSON text. */
export async function exportDataAction(): Promise<ActionResult<never, { json: string }>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthorized" };
  const data = await exportMyData(viewer.id);
  return { ok: true, json: JSON.stringify(data, null, 2) };
}

/** Deletes the signed-in user's account after they typed their username and password again. */
export async function deleteAccountAction(input: DeleteAccountInput): Promise<ActionResult<keyof DeleteAccountInput>> {
  const [viewer, profile] = await Promise.all([getViewer(), getViewerProfile()]);
  if (!viewer || !profile) return { ok: false, error: "unauthorized" };

  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalidInput", fieldErrors: toFieldErrors<keyof DeleteAccountInput>(parsed.error) };
  }
  if (parsed.data.username !== profile.username) {
    return { ok: false, error: "invalidInput", fieldErrors: { username: "deleteUsernameMismatch" } };
  }
  const ip = await clientIp();
  // The password check is a sign-in: same limits.
  if (!viewer.email || !(await checkRateLimit("signIn", { ip, email: viewer.email }))) {
    return { ok: false, error: "rateLimited" };
  }
  if (!(await passwordMatches(viewer.email, parsed.data.password))) {
    await recordAuthEvent("sign_in_failed", { email: viewer.email, ip });
    return { ok: false, error: "invalidInput", fieldErrors: { password: "deleteWrongPassword" } };
  }

  await deleteAccount(viewer.id);
  await recordAuthEvent("account_deleted", { ip });
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return { ok: true };
}
