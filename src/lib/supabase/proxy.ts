import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase auth session for the incoming request and returns the
 * response that carries any updated auth cookies, plus whether someone is signed in.
 *
 * `requestHeaders` are forwarded to the render (they carry the CSP nonce), so
 * refreshed cookies are copied into them too; otherwise Server Components would
 * see the stale token and try to refresh it a second time.
 */
export async function updateSession(request: NextRequest, requestHeaders: Headers) {
  const env = getPublicEnv();
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          requestHeaders.set("cookie", request.headers.get("cookie") ?? "");

          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims: the refresh must
  // happen before the response is committed.
  const { data } = await supabase.auth.getClaims();

  return { response, signedIn: Boolean(data?.claims?.sub) };
}
