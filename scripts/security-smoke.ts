/**
 * Security smoke test against a running site (security addendum). Opens public pages as a guest and
 * checks the headers from next.config.ts (static) and src/proxy.ts (CSP with a per-request nonce), then
 * checks that the cron route refuses calls without its secret. Prints a table; exits 1 on any failure.
 *
 *   pnpm security:smoke [baseUrl]        default http://localhost:3000
 *
 * Point it at a production build (`pnpm build && pnpm start`) or a deployment: `next dev` adds
 * 'unsafe-eval' to the CSP, which is reported as a failure.
 */
import { pathToFileURL } from "node:url";

/** Public pages and the status a guest should get. Non-HTML responses skip the proxy, so have no CSP. */
export const PAGES: { path: string; status: number; html: boolean }[] = [
  { path: "/", status: 200, html: true },
  { path: "/mavzular", status: 200, html: true },
  { path: "/qidiruv?q=python", status: 200, html: true },
  { path: "/haftalik", status: 200, html: true },
  { path: "/qoidalar", status: 200, html: true },
  { path: "/maxfiylik", status: 200, html: true },
  { path: "/shartlar", status: 200, html: true },
  { path: "/kirish", status: 200, html: true },
  { path: "/royxatdan-otish", status: 200, html: true },
  { path: "/removal-request", status: 200, html: true },
  { path: "/robots.txt", status: 200, html: false },
  { path: "/sitemap.xml", status: 200, html: false },
  { path: "/sahifa-yoq", status: 404, html: true },
];

const CRON_PATH = "/api/cron/link-check";
const ONE_YEAR = 31_536_000;

/** Sources that would reopen what the CSP is there to close. */
const UNSAFE_SOURCES = new Set(["*", "'unsafe-inline'", "'unsafe-eval'", "data:", "http:", "https:"]);

/** Directive name → source list. A repeated directive is ignored, as browsers do. */
export function parseCsp(value: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of value.split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name && !directives.has(name.toLowerCase())) directives.set(name.toLowerCase(), sources);
  }
  return directives;
}

function checkCsp(value: string | null): string[] {
  if (!value) return ["Content-Security-Policy: missing"];
  const csp = parseCsp(value);
  const problems: string[] = [];

  /** The directive must be present and allow nothing beyond `allowed`. */
  const only = (name: string, allowed: string[]) => {
    const sources = csp.get(name);
    if (!sources || sources.length === 0 || sources.some((source) => !allowed.includes(source))) {
      problems.push(`CSP ${name}: expected ${allowed.join(" or ")}, got ${sources?.join(" ") || "nothing"}`);
    }
  };
  only("default-src", ["'self'", "'none'"]);
  only("object-src", ["'none'"]);
  only("base-uri", ["'self'", "'none'"]);
  only("form-action", ["'self'", "'none'"]);
  only("frame-ancestors", ["'none'"]);

  const scripts = csp.get("script-src") ?? [];
  if (!scripts.some((source) => source.startsWith("'nonce-"))) problems.push("CSP script-src: no nonce");
  if (!scripts.includes("'strict-dynamic'")) problems.push("CSP script-src: no 'strict-dynamic'");
  const unsafe = scripts.filter((source) => UNSAFE_SOURCES.has(source));
  if (unsafe.length > 0) problems.push(`CSP script-src: allows ${unsafe.join(" ")}`);

  return problems;
}

function checkHsts(value: string | null): string[] {
  if (!value) return ["Strict-Transport-Security: missing"];
  const problems: string[] = [];
  const maxAge = Number(/max-age=(\d+)/i.exec(value)?.[1] ?? 0);
  if (maxAge < ONE_YEAR) problems.push("Strict-Transport-Security: max-age under one year");
  if (!/includeSubDomains/i.test(value)) problems.push("Strict-Transport-Security: no includeSubDomains");
  return problems;
}

/** `camera=(), geolocation=(self)` → feature → allowlist. */
function parsePermissionsPolicy(value: string): Map<string, string> {
  return new Map(
    value
      .split(",")
      .map((entry) => entry.trim().split("="))
      .filter(([feature, allowlist]) => feature && allowlist !== undefined)
      .map(([feature, allowlist]): [string, string] => [feature.toLowerCase(), allowlist.replace(/\s+/g, "")]),
  );
}

function expectValue(headers: Headers, name: string, expected: string): string[] {
  const value = headers.get(name);
  if (value === null) return [`${name}: missing`];
  return value.trim().toLowerCase() === expected.toLowerCase() ? [] : [`${name}: expected ${expected}, got ${value}`];
}

/**
 * Pure check of one response's headers; returns the problems found (empty when all is well). `html`
 * responses must also carry the CSP, which the proxy adds to pages only.
 */
export function checkSecurityHeaders(headers: Headers, { html }: { html: boolean }): string[] {
  const problems = [
    ...(html ? checkCsp(headers.get("content-security-policy")) : []),
    ...checkHsts(headers.get("strict-transport-security")),
    ...expectValue(headers, "X-Content-Type-Options", "nosniff"),
    ...expectValue(headers, "Referrer-Policy", "strict-origin-when-cross-origin"),
    ...expectValue(headers, "Cross-Origin-Opener-Policy", "same-origin"),
    ...expectValue(headers, "X-Frame-Options", "DENY"),
  ];

  const permissions = headers.get("permissions-policy");
  if (permissions === null) {
    problems.push("Permissions-Policy: missing");
  } else {
    const policy = parsePermissionsPolicy(permissions);
    for (const feature of ["camera", "microphone", "geolocation"]) {
      if (policy.get(feature) !== "()") problems.push(`Permissions-Policy: ${feature} is not disabled`);
    }
  }

  if (headers.has("x-powered-by")) problems.push("X-Powered-By: should not be sent");
  return problems;
}

type Row = { target: string; status: string; problems: string[] };

async function get(url: URL, headers?: HeadersInit): Promise<Response> {
  // Redirects are not followed: a guest page that redirects is itself a finding.
  const response = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(30_000) });
  await response.body?.cancel();
  return response;
}

function failure(target: string, error: unknown): Row {
  // fetch() reports "fetch failed"; the cause says why (ECONNREFUSED, a timeout, ...).
  const cause = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : "";
  const message = error instanceof Error ? error.message : String(error);
  return { target, status: "-", problems: [`request failed: ${message}${cause}`] };
}

async function checkPage(baseUrl: URL, page: (typeof PAGES)[number]): Promise<Row> {
  try {
    const response = await get(new URL(page.path, baseUrl));
    const problems: string[] = [];
    if (response.status !== page.status) problems.push(`status ${response.status}, expected ${page.status}`);
    const isHtml = response.headers.get("content-type")?.includes("text/html") ?? false;
    if (isHtml !== page.html) problems.push(`Content-Type: ${response.headers.get("content-type") ?? "missing"}`);
    problems.push(...checkSecurityHeaders(response.headers, { html: page.html }));
    return { target: page.path, status: String(response.status), problems };
  } catch (error) {
    return failure(page.path, error);
  }
}

/** The nonce must change on every request, or an injected script could reuse it. */
async function checkNonce(baseUrl: URL): Promise<Row> {
  const target = "/ (CSP nonce per request)";
  try {
    const nonces = await Promise.all(
      [1, 2].map(async () => {
        const csp = (await get(new URL("/", baseUrl))).headers.get("content-security-policy") ?? "";
        return parseCsp(csp)
          .get("script-src")
          ?.find((source) => source.startsWith("'nonce-"));
      }),
    );
    const problems = !nonces[0] ? ["no nonce"] : nonces[0] === nonces[1] ? ["same nonce twice"] : [];
    return { target, status: "-", problems };
  } catch (error) {
    return failure(target, error);
  }
}

/** Without the right `Authorization: Bearer <CRON_SECRET>` the cron route must refuse to run. */
async function checkCron(baseUrl: URL, label: string, headers?: HeadersInit): Promise<Row> {
  const target = `${CRON_PATH} (${label})`;
  try {
    const response = await get(new URL(CRON_PATH, baseUrl), headers);
    const refused = response.status === 401 || response.status === 403;
    return { target, status: String(response.status), problems: refused ? [] : ["expected 401 or 403"] };
  } catch (error) {
    return failure(target, error);
  }
}

function printTable(rows: Row[]) {
  const width = Math.max(...rows.map((row) => row.target.length));
  console.log(`  ${"TARGET".padEnd(width)}  CODE  RESULT`);
  for (const { target, status, problems } of rows) {
    console.log(`  ${target.padEnd(width)}  ${status.padEnd(4)}  ${problems.length === 0 ? "ok" : "FAIL"}`);
    for (const problem of problems) console.log(`  ${" ".repeat(width)}        - ${problem}`);
  }
}

async function main() {
  const baseUrl = new URL(process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "http://localhost:3000");
  console.log(`Security smoke test against ${baseUrl.origin}\n`);

  const rows: Row[] = [];
  // One at a time: a dev server compiles each page on first request.
  for (const page of PAGES) rows.push(await checkPage(baseUrl, page));
  rows.push(await checkNonce(baseUrl));
  rows.push(await checkCron(baseUrl, "no secret"));
  rows.push(await checkCron(baseUrl, "wrong secret", { Authorization: "Bearer not-the-cron-secret-0000" }));

  printTable(rows);
  const failed = rows.filter((row) => row.problems.length > 0).length;
  console.log(`\n${rows.length} checks, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

// Runs only as a CLI (`tsx scripts/security-smoke.ts`), not when a test imports the functions above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
