/** App paths used in more than one place. Email templates link to `confirmEmail` and `newPassword`. */
export const routes = {
  home: "/",
  /** The home feed's "Yangi" tab. */
  newest: "/?tartib=yangi",
  signIn: "/kirish",
  signUp: "/royxatdan-otish",
  confirmEmail: "/email-tasdiqlash",
  resetPassword: "/parolni-tiklash",
  newPassword: "/parolni-tiklash/yangi",
  settings: "/sozlamalar",
  welcome: "/sozlamalar?xush-kelibsiz=1",
  rules: "/qoidalar",
  terms: "/shartlar",
  profile: (username: string) => `/u/${encodeURIComponent(username)}`,
  newResource: "/yangi-resurs",
  resource: (slug: string) => `/resurs/${encodeURIComponent(slug)}`,
  editResource: (slug: string) => `/resurs/${encodeURIComponent(slug)}/tahrirlash`,
  topic: (slug: string) => `/mavzu/${encodeURIComponent(slug)}`,
  topics: "/mavzular",
  search: "/qidiruv",
  saved: "/saqlanganlar",
  following: "/obunalarim",
  /** Sign-in that returns to `path` afterwards (for actions guests cannot take). */
  signInTo: (path: string) => `/kirish?next=${encodeURIComponent(path)}`,
  removalRequest: "/removal-request",
  admin: "/admin",
  adminResources: "/admin/resurslar",
  adminReports: "/admin/shikoyatlar",
  adminLinks: "/admin/havolalar",
  adminUsers: "/admin/foydalanuvchilar",
  adminTopics: "/admin/mavzular",
  adminDomains: "/admin/domenlar",
} as const;

/**
 * Pages that need a signed-in user. The proxy redirects guests before rendering starts (a real 307,
 * no loading skeleton); each page still calls requireViewer() itself.
 */
const protectedPrefixes = [routes.settings, routes.newResource, routes.saved, routes.following, routes.admin] as const;
const protectedPatterns = [/^\/resurs\/[^/]+\/tahrirlash\/?$/] as const;

export function isProtectedPath(pathname: string): boolean {
  return (
    protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    protectedPatterns.some((pattern) => pattern.test(pathname))
  );
}

/** Pages that make no sense once signed in; the proxy sends signed-in users on to `?next=`. */
export function isGuestOnlyPath(pathname: string): boolean {
  return pathname === routes.signIn || pathname === routes.signUp;
}

/** `/u/Nodira` → `/u/nodira` (usernames are lower-case), or null when already canonical. */
export function canonicalProfilePath(pathname: string): string | null {
  const match = /^\/u\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  const canonical = `/u/${match[1].toLowerCase()}`;
  return canonical === pathname ? null : canonical;
}

/** Absolute URL on the current origin, for links that Supabase puts into emails. */
export function absoluteUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}
