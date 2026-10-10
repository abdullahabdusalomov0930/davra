"use server";

import { revalidatePath } from "next/cache";
import { z } from "@/lib/zod";

import type { ActionResult } from "@/lib/action-result";
import { type BlockedDomainInput, blockedDomainSchema, type TopicInput, topicSchema } from "@/lib/validators";
import { getStaffProfile, getViewer } from "@/server/auth/session";
import type { LinkCheckOutcome } from "@/server/link-check/check-link";
import { recheckLink } from "@/server/link-check/job";
import {
  addBlockedDomain,
  createTopic,
  decideLinkStatus,
  deleteTopic,
  removeBlockedDomain,
  resolveReportWithAction,
  setCommentStatus,
  setRemovalRequestStatus,
  setReportStatus,
  setResourceStatus,
  setUserBanned,
  setUserRole,
  updateTopic,
} from "@/server/services/moderation";
import { Constants } from "@/types/database";

import { toFieldErrors } from "./validation";

// Every action runs as the signed-in staff member: RLS and the guard triggers decide what each role
// may do, and the audit log records it (D15, D16). These checks only reject malformed input early.

const id = z.uuid();
const enums = Constants.public.Enums;

async function signedIn(): Promise<boolean> {
  return Boolean(await getViewer());
}

/** Validates, runs, and refreshes every page (statuses show up in feeds, queues and resource pages). */
async function run<T extends ActionResult<string>>(
  valid: boolean,
  action: () => Promise<T>,
): Promise<T | ActionResult> {
  if (!(await signedIn())) return { ok: false, error: "unauthorized" };
  if (!valid) return { ok: false, error: "invalidInput" };
  const result = await action();
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function moderateResourceAction(resourceId: string, status: string) {
  const parsed = z.enum(enums.resource_status).safeParse(status);
  return run(id.safeParse(resourceId).success && parsed.success, () => setResourceStatus(resourceId, parsed.data!));
}

/** "Ishlamayapti" / "Ishlayapti" on the Havolalar page; also closes the link's open reports. */
export async function decideLinkAction(resourceId: string, linkStatus: string) {
  const parsed = z.enum(["ok", "broken"]).safeParse(linkStatus);
  return run(id.safeParse(resourceId).success && parsed.success, () => decideLinkStatus(resourceId, parsed.data!));
}

type Recheck = { outcome: LinkCheckOutcome; linkStatus: (typeof enums.link_status)[number] | null };

/**
 * "Hozir tekshirish": runs the link checker on one link now. The exception to the rule above: the
 * checker records its result with the secret key, like the scheduled run (D56), so staff are checked
 * here. It records what the checker saw, never a person's decision.
 */
export async function recheckLinkAction(resourceId: string): Promise<ActionResult<never, Recheck>> {
  if (!(await getStaffProfile())) return { ok: false, error: "forbidden" };
  if (!id.safeParse(resourceId).success) return { ok: false, error: "invalidInput" };

  const result = await recheckLink(resourceId);
  if (!result) return { ok: false, error: "notFound" };
  revalidatePath("/", "layout");
  return { ok: true, outcome: result.outcome, linkStatus: result.linkStatus };
}

export async function moderateCommentAction(commentId: string, status: string) {
  const parsed = z.enum(enums.comment_status).safeParse(status);
  return run(id.safeParse(commentId).success && parsed.success, () => setCommentStatus(commentId, parsed.data!));
}

/** "takeDown" hides the reported content (or bans the user) and resolves the report. */
export async function handleReportAction(reportId: string, decision: string) {
  const parsed = z.enum(["takeDown", "resolve", "dismiss"]).safeParse(decision);
  return run(id.safeParse(reportId).success && parsed.success, () =>
    parsed.data === "takeDown"
      ? resolveReportWithAction(reportId)
      : setReportStatus(reportId, parsed.data === "resolve" ? "resolved" : "dismissed"),
  );
}

export async function handleRemovalRequestAction(requestId: string, status: string) {
  const parsed = z.enum(["resolved", "dismissed"]).safeParse(status);
  return run(id.safeParse(requestId).success && parsed.success, () => setRemovalRequestStatus(requestId, parsed.data!));
}

export async function setUserBanAction(userId: string, banned: boolean) {
  return run(id.safeParse(userId).success && typeof banned === "boolean", () => setUserBanned(userId, banned));
}

export async function setUserRoleAction(userId: string, role: string) {
  const parsed = z.enum(enums.user_role).safeParse(role);
  return run(id.safeParse(userId).success && parsed.success, () => setUserRole(userId, parsed.data!));
}

export async function createTopicAction(input: TopicInput): Promise<ActionResult<keyof TopicInput>> {
  const parsed = topicSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalidInput", fieldErrors: toFieldErrors<keyof TopicInput>(parsed.error) };
  }
  return run(true, () => createTopic(parsed.data));
}

export async function updateTopicAction(topicId: string, input: TopicInput): Promise<ActionResult<keyof TopicInput>> {
  const parsed = topicSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalidInput", fieldErrors: toFieldErrors<keyof TopicInput>(parsed.error) };
  }
  return run(id.safeParse(topicId).success, () => updateTopic(topicId, parsed.data));
}

export async function deleteTopicAction(topicId: string) {
  return run(id.safeParse(topicId).success, () => deleteTopic(topicId));
}

export async function addDomainAction(input: BlockedDomainInput): Promise<ActionResult<keyof BlockedDomainInput>> {
  const parsed = blockedDomainSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalidInput", fieldErrors: toFieldErrors<keyof BlockedDomainInput>(parsed.error) };
  }
  return run(true, () => addBlockedDomain(parsed.data));
}

export async function removeDomainAction(domain: string) {
  return run(typeof domain === "string" && domain.length <= 253, () => removeBlockedDomain(domain));
}
