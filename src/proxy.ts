import { type NextRequest, NextResponse } from "next/server";

import { getPublicEnv } from "@/lib/env";
import { canonicalProfilePath, isGuestOnlyPath, isProtectedPath, routes } from "@/lib/routes";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { buildCsp } from "@/lib/security/csp";
import { updateSession } from "@/lib/supabase/proxy";

/** Redirect that keeps any auth cookies the session refresh just set. */
function redirectKeepingCookies(url: URL, from: NextResponse, status?: number) {
  const redirect = NextResponse.redirect(url, status);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    turnstile: Boolean(getPublicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY),
  });

  // Next.js reads the nonce from the request's CSP header and applies it to its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const { response, signedIn } = await updateSession(request, requestHeaders);

  // Redirects happen here, before rendering starts, so they are real 3xx responses (pages stream, and
  // a redirect inside a streamed page becomes a client-side one). Page loads only: Server Actions
  // (POST) check the session themselves and answer with a result.
  const { pathname, search, searchParams } = request.nextUrl;
  if (request.method === "GET") {
    if (!signedIn && isProtectedPath(pathname)) {
      const signIn = new URL(routes.signIn, request.url);
      signIn.searchParams.set("next", `${pathname}${search}`);
      return redirectKeepingCookies(signIn, response);
    }
    if (signedIn && isGuestOnlyPath(pathname)) {
      return redirectKeepingCookies(new URL(safeRedirectPath(searchParams.get("next")), request.url), response);
    }
    const profilePath = canonicalProfilePath(pathname);
    if (profilePath) {
      return redirectKeepingCookies(new URL(`${profilePath}${search}`, request.url), response, 308);
    }
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Skip static assets and link prefetches; they need neither a nonce nor a session refresh.
      source:
        "/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
