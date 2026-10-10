export const FAVICON_ORIGIN = "https://icons.duckduckgo.com";

/**
 * Favicon for a site, served by DuckDuckGo's icon service: no API key, no tracking cookies, and
 * the visitor's browser never contacts the shared site itself.
 */
export function faviconUrl(domain: string): string {
  return `${FAVICON_ORIGIN}/ip3/${encodeURIComponent(domain)}.ico`;
}
