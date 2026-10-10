import "server-only";

import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";

import { isPublicAddress } from "./address";

/**
 * Checks whether a resource's link still works (DECISIONS.md D56–D57).
 *
 *   ok       the page answered (2xx, or 3xx we did not need to follow)
 *   failure  the page is gone (404, 410, 5xx) or the site is unreachable (no such domain, refused,
 *            timed out, private address)
 *   unknown  the site would not tell a bot (401, 403, 429, bot challenges, other 4xx) or the problem
 *            may be on our side (TLS chain Node cannot verify, temporary DNS error)
 *
 * Only http(s) URLs are fetched, every redirect target is checked again, and every address a host name
 * resolves to must be public; the connection is made to exactly the address that was checked.
 */

export type LinkCheckOutcome = "ok" | "failure" | "unknown";

export type LinkCheckResult = {
  outcome: LinkCheckOutcome;
  /** Short machine-readable cause for logs and tests: "http 404", "timeout", "dns", … */
  reason: string;
};

export type LinkCheckOptions = {
  userAgent: string;
  /** Time limit for the HEAD attempt and for the GET attempt, each with all its redirects. */
  headTimeoutMs?: number;
  getTimeoutMs?: number;
  maxRedirects?: number;
  /** Tests only: the local test server listens on 127.0.0.1. */
  isAllowedAddress?: (address: string) => boolean;
};

const DEFAULTS = { headTimeoutMs: 4_000, getTimeoutMs: 7_000, maxRedirects: 5 };

const BLOCKED = "ERR_LINK_CHECK_BLOCKED";

type Attempt = LinkCheckResult & {
  /** No point asking again with GET: the answer would be the same (no such domain, private address…). */
  final?: boolean;
};

const ok = (reason: string): Attempt => ({ outcome: "ok", reason });
const failure = (reason: string, final = false): Attempt => ({ outcome: "failure", reason, final });
const unknown = (reason: string, final = false): Attempt => ({ outcome: "unknown", reason, final });

export async function checkLink(link: string, options: LinkCheckOptions): Promise<LinkCheckResult> {
  const settings = { ...DEFAULTS, isAllowedAddress: isPublicAddress, ...options };

  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return { outcome: "failure", reason: "invalid url" };
  }

  // Some servers answer HEAD wrongly (405, 404, or not at all), so anything but a clear "ok" is asked
  // again with GET, whose answer then counts.
  const head = await attempt(url, "HEAD", settings.headTimeoutMs, settings);
  if (head.outcome === "ok" || head.final) return strip(head);
  return strip(await attempt(url, "GET", settings.getTimeoutMs, settings));
}

function strip({ outcome, reason }: Attempt): LinkCheckResult {
  return { outcome, reason };
}

type Settings = Required<LinkCheckOptions>;

/** One method, following redirects, within one time limit. */
async function attempt(start: URL, method: "HEAD" | "GET", timeoutMs: number, settings: Settings) {
  const signal = AbortSignal.timeout(timeoutMs);
  const lookup = guardedLookup(settings.isAllowedAddress);
  let url = start;

  for (let redirects = 0; ; redirects++) {
    const refused = refuseTarget(url, settings.isAllowedAddress);
    if (refused) return refused;

    let response: Answer;
    try {
      response = await send(url, method, { lookup, signal, userAgent: settings.userAgent });
    } catch (error) {
      return signal.aborted ? failure("timeout") : classifyError(error);
    }

    if (isRedirect(response.status) && response.location) {
      if (redirects === settings.maxRedirects) {
        // Usually a cookie or login loop that a browser gets through, not a dead link.
        return unknown("too many redirects", true);
      }
      try {
        url = new URL(response.location, url);
      } catch {
        return failure("bad redirect", true);
      }
      continue;
    }

    return classifyStatus(response);
  }
}

function refuseTarget(url: URL, isAllowedAddress: (address: string) => boolean): Attempt | undefined {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return failure("not http", true);
  }
  // IP literals are connected to directly, without a DNS lookup, so they are checked here.
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");
  if (isIP(host) && !isAllowedAddress(host)) {
    return failure("blocked address", true);
  }
  return undefined;
}

/** dns.lookup that refuses a host when any of its addresses is not public (DNS rebinding included). */
function guardedLookup(isAllowedAddress: (address: string) => boolean): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
      if (error) {
        callback(error, "");
        return;
      }
      if (addresses.length === 0 || !addresses.every(({ address }) => isAllowedAddress(address))) {
        callback(Object.assign(new Error(`${hostname} resolves to a non-public address`), { code: BLOCKED }), "");
        return;
      }
      if (options.all) {
        callback(null, addresses);
      } else {
        callback(null, addresses[0].address, addresses[0].family);
      }
    });
  };
}

type Answer = { status: number; location?: string; challenge: boolean };

function send(
  url: URL,
  method: "HEAD" | "GET",
  { lookup, signal, userAgent }: { lookup: LookupFunction; signal: AbortSignal; userAgent: string },
): Promise<Answer> {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      {
        method,
        lookup,
        signal,
        // A fresh connection per request: nothing is pooled between sites.
        agent: false,
        headers: {
          "user-agent": userAgent,
          accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          "accept-language": "uz,ru;q=0.8,en;q=0.7",
        },
      },
      (response) => {
        resolve({
          status: response.statusCode ?? 0,
          location: response.headers.location,
          // Cloudflare's "checking your browser" page.
          challenge: response.headers["cf-mitigated"] !== undefined,
        });
        // Only the status matters; the body is never downloaded.
        response.destroy();
      },
    );
    request.on("error", reject);
    request.end();
  });
}

function isRedirect(status: number) {
  return [301, 302, 303, 307, 308].includes(status);
}

function classifyStatus({ status, challenge }: Answer): Attempt {
  const reason = `http ${status}`;
  if (status >= 200 && status < 400) return ok(reason);
  if (challenge) return unknown("bot challenge");
  if (status === 404 || status === 410) return failure(reason);
  if (status >= 500 && status < 600) return failure(reason);
  // 401, 403, 429, 451, other 4xx and non-standard codes: the site did not say the page is gone.
  return unknown(reason);
}

function classifyError(error: unknown): Attempt {
  const code = (error as NodeJS.ErrnoException | undefined)?.code ?? "";

  if (code === BLOCKED) return failure("blocked address", true);
  if (code === "ENOTFOUND" || code === "EAI_NONAME" || code === "EAI_NODATA") return failure("dns", true);
  if (code === "EAI_AGAIN") return unknown("dns temporary", true);
  if (code === "ECONNREFUSED") return failure("refused", true);
  // Certificates Node cannot verify (missing intermediate, a national CA) often open fine in browsers.
  if (/CERT|SELF_SIGNED|UNABLE_TO|ERR_TLS|ERR_SSL/.test(code)) return unknown("tls", true);
  // HTTP that browsers tolerate but Node's strict parser does not.
  if (code.startsWith("HPE_")) return unknown("http parse");
  // Our network cannot reach that address family (e.g. IPv6-only site).
  if (code === "ENETUNREACH") return unknown("network unreachable");
  return failure(code ? `network ${code}` : "network");
}
