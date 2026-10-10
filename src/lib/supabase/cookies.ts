/**
 * Session cookies (security addendum 5.1): HttpOnly, so page scripts cannot read the tokens (all
 * authentication runs on the server, D74); Secure outside local development; SameSite=Lax.
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;
