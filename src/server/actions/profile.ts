"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import { type ProfileInput, profileSchema } from "@/lib/validators";
import { getViewer } from "@/server/auth/session";
import { updateProfile } from "@/server/services/profiles";

import { toFieldErrors } from "./validation";

export async function updateProfileAction(input: ProfileInput): Promise<ActionResult<keyof ProfileInput>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthorized" };

  // The argument comes from the browser: validate it again, whatever the form already checked.
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalidInput", fieldErrors: toFieldErrors<keyof ProfileInput>(parsed.error) };
  }

  const result = await updateProfile(viewer.id, parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
