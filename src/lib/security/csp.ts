type CspOptions = {
  nonce: string;
  isDev: boolean;
  /** Cloudflare Turnstile is configured: its widget runs in a frame from challenges.cloudflare.com. */
  turnstile?: boolean;
};

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/**
 * Builds the Content-Security-Policy header value.
 *
 * Scripts are locked down with a per-request nonce + 'strict-dynamic'.
 * Styles allow 'unsafe-inline' because React renders `style` attributes and
 * UI primitives position popovers with inline styles; style injection is a far
 * smaller risk than script injection. See DECISIONS.md.
 */
export function buildCsp({ nonce, isDev, turnstile = false }: CspOptions): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    // No user images and no third-party icons (security addendum): only the site's own images.
    "img-src": ["'self'", "data:"],
    "font-src": ["'self'"],
    // The browser only talks to this site: authentication runs on the server (D74).
    "connect-src": ["'self'"],
    "frame-src": turnstile ? [TURNSTILE_ORIGIN] : ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'"],
  };

  const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}
