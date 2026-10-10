const PLACEHOLDER_ORIGIN = "http://placeholder.invalid";

/**
 * Returns `value` if it is a path on this site, otherwise `fallback`. Used for `?next=` after
 * sign-in so the parameter cannot send people to another site (open redirect).
 */
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length > 512) return fallback;
  // Only root-relative paths. "//host" and "/\host" are protocol-relative in browsers.
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Browsers strip tabs and newlines from URLs, which can turn "/\t/host" into "//host".
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return fallback;
  }

  try {
    const url = new URL(value, PLACEHOLDER_ORIGIN);
    if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
