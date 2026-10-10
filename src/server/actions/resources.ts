"use server";

import { revalidatePath } from "next/cache";
import { z } from "@/lib/zod";

import type { ActionResult } from "@/lib/action-result";
import { normalizeUrl } from "@/lib/url-normalize";
import { type ResourceInput, resourceSchema } from "@/lib/validators";
import { getViewer } from "@/server/auth/session";
import {
  createResource,
  deleteResource,
  findDuplicate,
  type ResourceStatus,
  updateResource,
} from "@/server/services/resources";

import { toFieldErrors } from "./validation";

type ResourceResult = ActionResult<keyof ResourceInput, { slug: string; status: ResourceStatus }>;

const idSchema = z.uuid();

export type DuplicateCheck =
  { status: "invalid" } | { status: "ok"; url: string } | { status: "duplicate"; url: string; slug?: string };

/** Friendly early check while typing the link; the unique constraint stays the real guard. */
export async function checkResourceUrlAction(rawUrl: string, excludeId?: string): Promise<DuplicateCheck> {
  const viewer = await getViewer();
  const normalized = normalizeUrl(typeof rawUrl === "string" ? rawUrl : "");
  if (!viewer || !normalized.ok) return { status: "invalid" };

  const exclude = excludeId && idSchema.safeParse(excludeId).success ? excludeId : undefined;
  const duplicate = await findDuplicate(normalized.url, viewer.id, exclude);
  return duplicate
    ? { status: "duplicate", url: normalized.url, slug: duplicate.slug }
    : { status: "ok", url: normalized.url };
}

export async function createResourceAction(input: ResourceInput): Promise<ResourceResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthorized" };

  const parsed = resourceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalidInput", fieldErrors: toFieldErrors<keyof ResourceInput>(parsed.error) };
  }

  const result = await createResource(viewer.id, parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateResourceAction(id: string, input: ResourceInput): Promise<ResourceResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthorized" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "invalidInput" };

  const parsed = resourceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalidInput", fieldErrors: toFieldErrors<keyof ResourceInput>(parsed.error) };
  }

  const result = await updateResource(viewer.id, id, parsed.data);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function deleteResourceAction(id: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthorized" };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "invalidInput" };

  const result = await deleteResource(viewer.id, id);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
