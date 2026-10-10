type SearchParams = Record<string, string | string[] | undefined>;

/** First value of a query parameter, or undefined. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Tokens and codes from Supabase emails are short URL-safe strings; anything else is ignored. */
function token(value: string | string[] | undefined): string | undefined {
  const raw = firstParam(value);
  return raw && /^[A-Za-z0-9_-]{8,256}$/.test(raw) ? raw : undefined;
}

/**
 * The confirmation email links here with `token_hash` and `type` (our template) or, with Supabase's
 * default template, with a PKCE `code` that only works in the browser that signed up.
 */
export function parseConfirmationLink(params: SearchParams) {
  const tokenHash = token(params.token_hash);
  const type = firstParam(params.type);
  if (tokenHash && (type === "email" || type === "signup")) return { tokenHash, type } as const;

  const code = token(params.code);
  return code ? ({ code } as const) : null;
}

export function parseRecoveryLink(params: SearchParams) {
  const tokenHash = token(params.token_hash);
  if (tokenHash && firstParam(params.type) === "recovery") return { tokenHash } as const;

  const code = token(params.code);
  return code ? ({ code } as const) : null;
}
