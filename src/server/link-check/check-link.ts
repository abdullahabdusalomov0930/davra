import "server-only";

import { safeFetch, SafeFetchError, type SafeFetchOptions, type SafeResponse } from "@/server/safety/safe-fetch";

/**
 * Checks whether a resource's link still works (DECISIONS.md D56–D57). Requests go through safeFetch,
 * which does the SSRF protection; this module only decides what an answer means.
 *
 *   ok       the page answered (2xx, or 3xx we did not need to follow)
 *   failure  the page is gone (404, 410, 5xx) or the site is unreachable (no such domain, refused,
 *            timed out, private address, non-standard port)
 *   unknown  the site would not tell a bot (401, 403, 429, bot challenges, other 4xx) or the problem
 *            may be on our side (TLS chain Node cannot verify, temporary DNS error, redirect loops)
 */

export type LinkCheckOutcome = "ok" | "failure" | "unknown";

export type LinkCheckResult = {
  outcome: LinkCheckOutcome;
  /** Short machine-readable cause for logs and tests: "http 404", "timeout", "dns", … */
  reason: string;
};

export type LinkCheckOptions = Pick<SafeFetchOptions, "userAgent" | "isAllowedAddress" | "isAllowedPort"> & {
  /** Time limit for the HEAD attempt and for the GET attempt, each with all its redirects. */
  headTimeoutMs?: number;
  getTimeoutMs?: number;
};

type Attempt = LinkCheckResult & {
  /** No point asking again with GET: the answer would be the same (no such domain, private address…). */
  final?: boolean;
};

const ERROR_RESULTS: Record<SafeFetchError["code"], Attempt> = {
  invalid_url: { outcome: "failure", reason: "invalid url", final: true },
  blocked_scheme: { outcome: "failure", reason: "not http", final: true },
  blocked_port: { outcome: "failure", reason: "blocked port", final: true },
  blocked_address: { outcome: "failure", reason: "blocked address", final: true },
  credentials: { outcome: "failure", reason: "credentials", final: true },
  bad_redirect: { outcome: "failure", reason: "bad redirect", final: true },
  // Usually a cookie or login loop that a browser gets through, not a dead link.
  too_many_redirects: { outcome: "unknown", reason: "too many redirects", final: true },
  timeout: { outcome: "failure", reason: "timeout" },
  dns: { outcome: "failure", reason: "dns", final: true },
  dns_temporary: { outcome: "unknown", reason: "dns temporary", final: true },
  refused: { outcome: "failure", reason: "refused", final: true },
  // Certificates Node cannot verify (missing intermediate, a national CA) often open fine in browsers.
  tls: { outcome: "unknown", reason: "tls", final: true },
  // HTTP that browsers tolerate but Node's strict parser does not.
  http_parse: { outcome: "unknown", reason: "http parse" },
  // Our network cannot reach that address family (e.g. an IPv6-only site).
  unreachable: { outcome: "unknown", reason: "network unreachable" },
  network: { outcome: "failure", reason: "network" },
};

function classifyStatus({ status, challenge }: SafeResponse): Attempt {
  const reason = `http ${status}`;
  if (status >= 200 && status < 400) return { outcome: "ok", reason };
  if (challenge) return { outcome: "unknown", reason: "bot challenge" };
  if (status === 404 || status === 410 || (status >= 500 && status < 600)) return { outcome: "failure", reason };
  // 401, 403, 429, 451, other 4xx and non-standard codes: the site did not say the page is gone.
  return { outcome: "unknown", reason };
}

async function attempt(link: string, method: "HEAD" | "GET", timeoutMs: number, options: LinkCheckOptions) {
  try {
    return classifyStatus(await safeFetch(link, { ...options, method, timeoutMs }));
  } catch (error) {
    if (error instanceof SafeFetchError) return ERROR_RESULTS[error.code];
    throw error;
  }
}

export async function checkLink(link: string, options: LinkCheckOptions): Promise<LinkCheckResult> {
  // Some servers answer HEAD wrongly (405, 404, or not at all), so anything but a clear "ok" is asked
  // again with GET, whose answer counts.
  const head = await attempt(link, "HEAD", options.headTimeoutMs ?? 4_000, options);
  const result =
    head.outcome === "ok" || head.final ? head : await attempt(link, "GET", options.getTimeoutMs ?? 7_000, options);
  return { outcome: result.outcome, reason: result.reason };
}
