type CspOptions = {
  nonce: string;
  isDev: boolean;
  supabaseUrl: string;
};

/**
 * Builds the Content-Security-Policy header value.
 *
 * Scripts are locked down with a per-request nonce + 'strict-dynamic'.
 * Styles allow 'unsafe-inline' because React renders `style` attributes and
 * UI primitives position popovers with inline styles; style injection is a far
 * smaller risk than script injection. See DECISIONS.md.
 */
export function buildCsp({ nonce, isDev, supabaseUrl }: CspOptions): string {
  const supabaseOrigin = new URL(supabaseUrl).origin;

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", supabaseOrigin],
    "font-src": ["'self'"],
    "connect-src": ["'self'", supabaseOrigin],
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
