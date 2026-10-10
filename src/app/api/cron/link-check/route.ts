import { createHash, timingSafeEqual } from "node:crypto";

import { getCronSecret } from "@/server/env";
import { runLinkCheckJob } from "@/server/link-check/job";

// Vercel Cron calls this once a day (vercel.json) with `Authorization: Bearer $CRON_SECRET` (D58).
// Each run checks the links that are due and stops starting new checks after 40 seconds.
export const maxDuration = 60;

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function isAuthorized(request: Request) {
  const secret = getCronSecret();
  if (!secret) {
    console.warn("CRON_SECRET is not set (or shorter than 16 characters); the link check did not run.");
    return false;
  }
  // Digests have equal length, so the comparison takes the same time whatever was sent.
  return timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`));
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await runLinkCheckJob();
  console.info("Link check finished", summary);
  return Response.json(summary);
}
