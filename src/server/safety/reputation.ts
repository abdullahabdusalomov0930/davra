import "server-only";

import { getSafeBrowsingKey } from "@/server/env";

/**
 * What a reputation service knows about links (security addendum 2.1). Behind an interface so another
 * service can replace Google Safe Browsing, and so Davra works without any (the default).
 */
export type Reputation = "safe" | "flagged" | "unknown";

export interface UrlReputationProvider {
  readonly name: string;
  check(urls: readonly string[]): Promise<Map<string, Reputation>>;
}

const unknownFor = (urls: readonly string[]) => new Map(urls.map((url) => [url, "unknown" as const]));

/** No service configured: nothing is known. */
export class NoReputationProvider implements UrlReputationProvider {
  readonly name = "none";
  async check(urls: readonly string[]) {
    return unknownFor(urls);
  }
}

/** Google Safe Browsing Lookup API v4 (threatMatches:find). Errors and timeouts mean "unknown". */
export class SafeBrowsingProvider implements UrlReputationProvider {
  readonly name = "google-safe-browsing";

  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs = 3_000,
  ) {}

  async check(urls: readonly string[]) {
    const result = new Map(urls.map((url) => [url, "safe" as Reputation]));
    try {
      const response = await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: AbortSignal.timeout(this.timeoutMs),
          body: JSON.stringify({
            client: { clientId: "davra", clientVersion: "1.0" },
            threatInfo: {
              threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
              platformTypes: ["ANY_PLATFORM"],
              threatEntryTypes: ["URL"],
              threatEntries: urls.map((url) => ({ url })),
            },
          }),
        },
      );
      if (!response.ok) {
        // The key is never logged; the status says enough (403: bad key, 429: quota).
        console.warn("Safe Browsing lookup failed", { status: response.status });
        return unknownFor(urls);
      }
      const body = (await response.json()) as { matches?: { threat?: { url?: string } }[] };
      for (const match of body.matches ?? []) {
        if (match.threat?.url && result.has(match.threat.url)) result.set(match.threat.url, "flagged");
      }
      return result;
    } catch {
      console.warn("Safe Browsing lookup failed", { reason: "network or timeout" });
      return unknownFor(urls);
    }
  }
}

let warned = false;

export function getReputationProvider(): UrlReputationProvider {
  const key = getSafeBrowsingKey();
  if (key) return new SafeBrowsingProvider(key);
  if (!warned) {
    warned = true;
    console.warn("SAFE_BROWSING_API_KEY is not set; links are not checked against Google Safe Browsing.");
  }
  return new NoReputationProvider();
}
