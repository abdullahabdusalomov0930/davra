"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import { AVATAR_MAX_BYTES, detectImageType } from "@/lib/images";
import { type ProfileInput, profileSchema } from "@/lib/validators";
import { getViewer, getViewerProfile } from "@/server/auth/session";
import { clearAvatar, replaceAvatar, updateProfile } from "@/server/services/profiles";

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

export async function uploadAvatarAction(formData: FormData): Promise<ActionResult> {
  const viewer = await getViewerProfile();
  if (!viewer) return { ok: false, error: "unauthorized" };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "invalidInput" };
  if (file.size > AVATAR_MAX_BYTES) return { ok: false, error: "avatarTooLarge" };

  // Trust the bytes, not the declared type: only real JPEG/PNG/WebP files are stored.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return { ok: false, error: "avatarType" };

  const result = await replaceAvatar(viewer.id, { bytes, type }, viewer.avatar_url);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function removeAvatarAction(): Promise<ActionResult> {
  const viewer = await getViewerProfile();
  if (!viewer) return { ok: false, error: "unauthorized" };

  const result = await clearAvatar(viewer.id, viewer.avatar_url);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
