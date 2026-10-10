export type UrlErrorKey = "urlInvalid" | "urlCredentials" | "urlNotPublic" | "urlTooLong" | "urlPort";
export type NormalizedUrl = { ok: true; url: string } | { ok: false; error: UrlErrorKey };

export const URL_MAX_LENGTH = 2048;

/** Query parameters that only track where a click came from. `utm_*` is matched by prefix. */
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "yclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "_hsenc",
  "_hsmi",
  "mkt_tok",
  "ref_src",
  "ref_url",
  "ref",
]);

/** Where `ref` names a branch or tag rather than a referrer, so it stays. */
const KEEP_REF_HOSTS = new Set(["github.com", "gitlab.com", "bitbucket.org", "codeberg.org"]);

/** Share-tracking parameters that are safe to drop only on these hosts (elsewhere they may mean something). */
const HOST_TRACKING_PARAMS: Record<string, readonly string[]> = {
  "www.youtube.com": ["si", "feature", "pp", "ab_channel"],
  "open.spotify.com": ["si"],
};

const YOUTUBE_HOSTS = new Set(["youtube.com", "m.youtube.com", "www.youtube.com"]);

function isTracking(key: string, host: string): boolean {
  const name = key.toLowerCase();
  if (name === "ref" && KEEP_REF_HOSTS.has(host.replace(/^www\./, ""))) return false;
  return name.startsWith("utm_") || TRACKING_PARAMS.has(name) || (HOST_TRACKING_PARAMS[host]?.includes(name) ?? false);
}

/** Drops tracking parameters but keeps the others exactly as written (order and encoding). */
function stripTracking(search: string, host: string): string {
  if (!search) return "";
  const kept = search
    .slice(1)
    .split("&")
    .filter((pair) => {
      if (!pair) return false;
      const key = pair.split("=")[0];
      let decoded = key;
      try {
        decoded = decodeURIComponent(key.replace(/\+/g, " "));
      } catch {
        // Malformed escapes: judge the raw key.
      }
      return !isTracking(decoded, host);
    });
  return kept.length ? `?${kept.join("&")}` : "";
}

/**
 * Normalizes a resource link so the same page is stored only once (the database has a unique
 * constraint on the result). Lower-case host and punycode (by the URL parser), no fragment, no
 * tracking parameters, and one canonical form for YouTube links. The path is kept as written: some
 * sites serve "/kurs" and "/kurs/" differently, so `urlTwins` catches those duplicates. Accepts a bare
 * domain ("khanacademy.org" → https://khanacademy.org/). Rejects credentials, IP addresses, intranet
 * hosts and non-standard ports: resources must be public web pages.
 */
export function normalizeUrl(input: string): NormalizedUrl {
  let raw = input.trim();
  if (!raw || /\s/.test(raw)) return { ok: false, error: "urlInvalid" };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "urlInvalid" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, error: "urlInvalid" };
  if (url.username || url.password) return { ok: false, error: "urlCredentials" };

  const host = url.hostname;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) return { ok: false, error: "urlNotPublic" };
  if (!/^[a-z0-9.-]+$/.test(host)) return { ok: false, error: "urlInvalid" };
  // A public host has a dot and a real top-level domain (rules out localhost, *.local, *.internal).
  if (!/\.([a-z]{2,63}|xn--[a-z0-9-]+)$/.test(host) || /\.(local|localhost|internal|lan)$/.test(host)) {
    return { ok: false, error: "urlNotPublic" };
  }
  // Web pages live on the standard ports; ":8080" and the like point at test servers and admin panels.
  if (url.port && !["80", "443"].includes(url.port)) return { ok: false, error: "urlPort" };

  url.hash = "";

  // youtu.be/ID and m.youtube.com → www.youtube.com/watch?v=ID
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    if (!id) return { ok: false, error: "urlInvalid" };
    const time = url.searchParams.get("t");
    url = new URL(
      `https://www.youtube.com/watch?v=${encodeURIComponent(id)}${time ? `&t=${encodeURIComponent(time)}` : ""}`,
    );
  } else if (YOUTUBE_HOSTS.has(host)) {
    url.hostname = "www.youtube.com";
    url.protocol = "https:";
  }

  url.search = stripTracking(url.search, url.hostname);

  const normalized = url.toString();
  if (normalized.length > URL_MAX_LENGTH) return { ok: false, error: "urlTooLong" };
  return { ok: true, url: normalized };
}

/**
 * Spellings of the same page that the normalizer keeps apart: with or without "www.", http or https,
 * with or without a trailing slash. The duplicate check looks for all of them; the normalized URL
 * comes first.
 */
export function urlTwins(normalized: string): string[] {
  const base = new URL(normalized);
  const hosts = [base.hostname, base.hostname.startsWith("www.") ? base.hostname.slice(4) : `www.${base.hostname}`];
  const paths =
    base.pathname === "/"
      ? ["/"]
      : [base.pathname, base.pathname.endsWith("/") ? base.pathname.replace(/\/+$/, "") || "/" : `${base.pathname}/`];

  const twins = new Set([normalized]);
  for (const protocol of ["https:", "http:"]) {
    for (const hostname of hosts) {
      for (const pathname of paths) {
        const twin = new URL(base);
        twin.protocol = protocol;
        twin.hostname = hostname;
        twin.pathname = pathname;
        twins.add(twin.toString());
      }
    }
  }
  return [...twins];
}

/** Host without "www.", as stored in `resources.domain`. */
export function displayDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
