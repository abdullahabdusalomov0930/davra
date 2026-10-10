import type { Instrumentation } from "next";

/**
 * Error tracking hook (security addendum 5.9): every server error is logged as one structured line
 * without personal data (no query string, no cookies, no request body). To send errors to a tracker
 * such as Sentry, install its SDK and report from here; DSNs belong in server-only environment
 * variables.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const failure = error as Error & { digest?: string };
  console.error(
    JSON.stringify({
      level: "error",
      message: failure.message?.slice(0, 300),
      digest: failure.digest,
      method: request.method,
      // The path only: query strings can hold tokens or search terms.
      path: request.path.split("?")[0],
      route: context.routePath,
      kind: context.routeType,
    }),
  );
};
