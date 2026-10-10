import "server-only";

import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";

import { APP_NAME } from "@/lib/config";
import { getPublicEnv } from "@/lib/env";

import { isPublicAddress } from "./address";

/**
 * The only way server code requests a URL that came from a user (security addendum 5.6, DECISIONS.md
 * D57): the link checker, the submit-time redirect check and anything later.
 *
 * - http and https only, standard ports only (80/443), no credentials in the URL;
 * - every address a host resolves to must be public, and the connection goes to exactly the address
 *   that was checked (no DNS rebinding); IP literals are checked before connecting;
 * - at most 3 redirects, each target checked again;
 * - one time limit for the whole call (at most 8 s), at most 1 MB of body, read only when asked for;
 * - a fixed User-Agent, no cookies, no connection reuse.
 */

export type SafeFetchErrorCode =
  | "invalid_url"
  | "blocked_scheme"
  | "blocked_port"
  | "blocked_address"
  | "credentials"
  | "too_many_redirects"
  | "bad_redirect"
  | "timeout"
  | "dns"
  | "dns_temporary"
  | "refused"
  | "tls"
  | "http_parse"
  | "unreachable"
  | "network";

export class SafeFetchError extends Error {
  constructor(
    readonly code: SafeFetchErrorCode,
    /** The URL being requested when it failed (after any redirects). */
    readonly url: string,
  ) {
    super(code);
    this.name = "SafeFetchError";
  }
}

export type SafeFetchOptions = {
  userAgent: string;
  method?: "HEAD" | "GET";
  /** The whole call, redirects included. Capped at 8 s. */
  timeoutMs?: number;
  /** Capped at 3. */
  maxRedirects?: number;
  /** Read up to this many bytes of the body (GET only); capped at 1 MB. 0 = do not read it. */
  maxBodyBytes?: number;
  /** Tests only: the test server listens on 127.0.0.1 and a random port. */
  isAllowedAddress?: (address: string) => boolean;
  isAllowedPort?: (port: number) => boolean;
};

export type SafeResponse = {
  status: number;
  /** The URL that answered, after redirects. */
  url: string;
  /** Every URL visited before it. */
  redirects: string[];
  /** A redirect status whose Location was missing or unusable ends the chain here. */
  location?: string;
  contentType?: string;
  /** Cloudflare's bot challenge. */
  challenge: boolean;
  body?: Buffer;
  bodyTruncated?: boolean;
};

/** How the server introduces itself to the sites it visits. */
export function botUserAgent() {
  return `${APP_NAME}LinkChecker/1.0 (+${getPublicEnv().NEXT_PUBLIC_SITE_URL})`;
}

const LIMITS = { timeoutMs: 8_000, maxRedirects: 3, maxBodyBytes: 1024 * 1024 };
const STANDARD_PORTS = new Set([80, 443]);
const BLOCKED = "ERR_SAFE_FETCH_BLOCKED";

const isStandardPort = (port: number) => STANDARD_PORTS.has(port);

function portOf(url: URL) {
  return url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
}

/** Why the server must not request this URL, if it must not. */
export function refuseUrl(
  url: URL,
  { isAllowedAddress = isPublicAddress, isAllowedPort = isStandardPort } = {},
): SafeFetchErrorCode | undefined {
  if (url.protocol !== "http:" && url.protocol !== "https:") return "blocked_scheme";
  if (url.username || url.password) return "credentials";
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");
  if (isIP(host) && !isAllowedAddress(host)) return "blocked_address";
  if (!isAllowedPort(portOf(url))) return "blocked_port";
  return undefined;
}

/** dns.lookup that refuses a host when any of its addresses is not public. */
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
      if (options.all) callback(null, addresses);
      else callback(null, addresses[0].address, addresses[0].family);
    });
  };
}

function errorCode(error: unknown): SafeFetchErrorCode {
  const code = (error as NodeJS.ErrnoException | undefined)?.code ?? "";
  if (code === BLOCKED) return "blocked_address";
  if (code === "ENOTFOUND" || code === "EAI_NONAME" || code === "EAI_NODATA") return "dns";
  if (code === "EAI_AGAIN") return "dns_temporary";
  if (code === "ECONNREFUSED") return "refused";
  if (/CERT|SELF_SIGNED|UNABLE_TO|ERR_TLS|ERR_SSL/.test(code)) return "tls";
  if (code.startsWith("HPE_")) return "http_parse";
  if (code === "ENETUNREACH" || code === "EHOSTUNREACH") return "unreachable";
  return "network";
}

type Hop = Omit<SafeResponse, "url" | "redirects">;

function request(
  url: URL,
  method: "HEAD" | "GET",
  {
    lookup,
    signal,
    userAgent,
    maxBodyBytes,
  }: {
    lookup: LookupFunction;
    signal: AbortSignal;
    userAgent: string;
    maxBodyBytes: number;
  },
): Promise<Hop> {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method,
        lookup,
        signal,
        agent: false,
        headers: {
          "user-agent": userAgent,
          accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          "accept-language": "uz,ru;q=0.8,en;q=0.7",
        },
      },
      (response) => {
        const hop: Hop = {
          status: response.statusCode ?? 0,
          location: response.headers.location,
          contentType: response.headers["content-type"],
          challenge: response.headers["cf-mitigated"] !== undefined,
        };
        const isRedirect = [301, 302, 303, 307, 308].includes(hop.status);
        if (method === "HEAD" || maxBodyBytes === 0 || isRedirect) {
          response.destroy();
          resolve(hop);
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          chunks.push(chunk);
          if (size >= maxBodyBytes) {
            response.destroy();
            resolve({ ...hop, body: Buffer.concat(chunks).subarray(0, maxBodyBytes), bodyTruncated: true });
          }
        });
        response.on("end", () => resolve({ ...hop, body: Buffer.concat(chunks), bodyTruncated: false }));
        response.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

export async function safeFetch(link: string, options: SafeFetchOptions): Promise<SafeResponse> {
  const isAllowedAddress = options.isAllowedAddress ?? isPublicAddress;
  const isAllowedPort = options.isAllowedPort ?? isStandardPort;
  const timeoutMs = Math.min(options.timeoutMs ?? LIMITS.timeoutMs, LIMITS.timeoutMs);
  const maxRedirects = Math.min(options.maxRedirects ?? LIMITS.maxRedirects, LIMITS.maxRedirects);
  const maxBodyBytes = Math.min(options.maxBodyBytes ?? 0, LIMITS.maxBodyBytes);
  const method = options.method ?? "GET";

  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new SafeFetchError("invalid_url", link);
  }

  const signal = AbortSignal.timeout(timeoutMs);
  const lookup = guardedLookup(isAllowedAddress);
  const redirects: string[] = [];

  for (;;) {
    const refused = refuseUrl(url, { isAllowedAddress, isAllowedPort });
    if (refused) throw new SafeFetchError(refused, url.toString());

    let hop: Hop;
    try {
      hop = await request(url, method, { lookup, signal, userAgent: options.userAgent, maxBodyBytes });
    } catch (error) {
      throw new SafeFetchError(signal.aborted ? "timeout" : errorCode(error), url.toString());
    }

    const isRedirect = [301, 302, 303, 307, 308].includes(hop.status);
    if (!isRedirect || !hop.location) return { ...hop, url: url.toString(), redirects };

    if (redirects.length === maxRedirects) throw new SafeFetchError("too_many_redirects", url.toString());
    redirects.push(url.toString());
    try {
      url = new URL(hop.location, url);
    } catch {
      throw new SafeFetchError("bad_redirect", url.toString());
    }
  }
}
