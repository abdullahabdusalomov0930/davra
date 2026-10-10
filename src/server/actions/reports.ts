"use server";

import { headers } from "next/headers";

import type { ActionResult } from "@/lib/action-result";
import {
  brokenLinkReportSchema,
  type RemovalRequestInput,
  removalRequestSchema,
  type ReportInput,
  reportSchema,
} from "@/lib/validators";
import { getViewer } from "@/server/auth/session";
import { createRemovalRequest } from "@/server/services/removal-requests";
import { createBrokenLinkReport, createReport } from "@/server/services/reports";

import { toFieldErrors } from "./validation";

/** Report a resource, comment or user. Signed-in users only; limits and duplicates are checked by the database. */
export async function reportAction(input: ReportInput): Promise<ActionResult<keyof ReportInput>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthorized" };

  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalidInput", fieldErrors: toFieldErrors<keyof ReportInput>(parsed.error) };
  }
  if (parsed.data.targetType === "user" && parsed.data.targetId === viewer.id) {
    return { ok: false, error: "forbidden" };
  }
  return createReport(parsed.data);
}

/** "Havola ishlamayapti". Signed-in users only; one open report per user and resource. */
export async function reportBrokenLinkAction(resourceId: string): Promise<ActionResult> {
  if (!(await getViewer())) return { ok: false, error: "unauthorized" };

  const parsed = brokenLinkReportSchema.safeParse({ resourceId });
  if (!parsed.success) return { ok: false, error: "invalidInput" };
  return createBrokenLinkReport(parsed.data);
}

/** The visitor's IP as Vercel (or a local proxy) passes it on; only used for the per-IP limit. */
async function clientIp(): Promise<string> {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "unknown";
}

/** The public /removal-request form. No account needed; limited per IP address. */
export async function submitRemovalRequestAction(
  input: RemovalRequestInput,
): Promise<ActionResult<keyof RemovalRequestInput>> {
  const parsed = removalRequestSchema.safeParse(input);
  if (!parsed.success) {
    // A filled honeypot is a bot: answer like a success, store nothing.
    if (parsed.error.issues.some((issue) => issue.path[0] === "website")) return { ok: true };
    return { ok: false, error: "invalidInput", fieldErrors: toFieldErrors<keyof RemovalRequestInput>(parsed.error) };
  }
  return createRemovalRequest(parsed.data, await clientIp());
}
