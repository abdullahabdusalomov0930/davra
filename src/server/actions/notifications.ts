"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action-result";
import { type AppealInput, appealSchema } from "@/lib/validators";
import { getViewer } from "@/server/auth/session";
import { createAppeal, markNotificationsRead } from "@/server/services/notifications";

import { toFieldErrors } from "./validation";

/** One appeal per hidden resource or comment, or per ban; banned users may appeal too. */
export async function appealAction(input: AppealInput): Promise<ActionResult<keyof AppealInput>> {
  if (!(await getViewer())) return { ok: false, error: "unauthorized" };
  const parsed = appealSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalidInput", fieldErrors: toFieldErrors<keyof AppealInput>(parsed.error) };
  }
  const result = await createAppeal(parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function markNotificationsReadAction(): Promise<ActionResult> {
  if (!(await getViewer())) return { ok: false, error: "unauthorized" };
  await markNotificationsRead();
  revalidatePath("/", "layout");
  return { ok: true };
}
