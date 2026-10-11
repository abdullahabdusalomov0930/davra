/**
 * Dependency-free secret scanner: the pre-commit hook (.githooks/pre-commit) runs it on every commit, so
 * it also works on machines without gitleaks. It knows only a few high-confidence patterns; gitleaks
 * (CI job "secrets") has many more. Findings are printed as `file:line  rule`, never with the value.
 *
 *   tsx scripts/check-secrets.ts          staged files (what the commit will contain)
 *   tsx scripts/check-secrets.ts --all    every tracked file (pnpm secrets:scan)
 *
 * A verified false positive can be marked with a `gitleaks:allow` comment on its line (gitleaks honours
 * the same marker).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";

export type SecretFinding = { line: number; rule: string };

type Rule = {
  name: string;
  /** Global (`g`) so every match on a line is checked against `ignore`. */
  pattern: RegExp;
  /** Return true for a match that is known to be harmless. */
  ignore?: (match: string) => boolean;
};

/** Lines with this marker are skipped (gitleaks honours it too). */
const ALLOW_MARKER = "gitleaks:allow";

/** Characters that may continue a base64url-like token; used so `\b` does not cut a token short. */
const END = "(?![A-Za-z0-9_-])";

/**
 * The local Supabase stack signs its demo keys with a published secret; their payload names the issuer
 * "supabase-demo". They grant nothing outside a developer's own machine.
 */
function isSupabaseDemoJwt(token: string): boolean {
  const payload = token.split(".")[1];
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof claims === "object" && claims !== null && "iss" in claims && claims.iss === "supabase-demo";
  } catch {
    return false;
  }
}

const RULES: Rule[] = [
  // Supabase secret keys bypass Row Level Security (server-only, see src/server/env.ts).
  { name: "supabase-secret-key", pattern: new RegExp(`sb_secret_[A-Za-z0-9_-]{20,}${END}`, "g") },
  // Legacy Supabase keys (anon, service_role) and other signed tokens: header.payload.signature.
  {
    name: "jwt",
    pattern: new RegExp(`\\beyJ[A-Za-z0-9_-]{8,}\\.eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}${END}`, "g"),
    ignore: isSupabaseDemoJwt,
  },
  // AWS access key IDs; AWS's documentation examples end in "EXAMPLE".
  {
    name: "aws-access-key-id",
    pattern: /\b(?:AKIA|ASIA)[A-Z2-7]{16}\b/g,
    ignore: (match) => match.endsWith("EXAMPLE"),
  },
  { name: "private-key", pattern: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/g },
  { name: "google-api-key", pattern: new RegExp(`\\bAIza[A-Za-z0-9_-]{35}${END}`, "g") },
  { name: "github-token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/g },
  { name: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g },
];

/** `NAME=value` lines in .env files whose name says the value is a credential. */
const ENV_ASSIGNMENT =
  /^\s*(?:export\s+)?[A-Za-z0-9_]*(?:SECRET|TOKEN|PASSWORD|API_KEY)[A-Za-z0-9_]*\s*=\s*(["']?)([^\s"'#]{16,})\1/i;

/** `.env`, `.env.local`, `.env.production`, `ci.env`, ... but not the committed template. */
export function isEnvFile(path: string): boolean {
  const name = basename(path);
  if (name === ".env.example") return false;
  return /^\.env(?:\..+)?$/.test(name) || name.endsWith(".env");
}

/** Generated or vendored files that are never scanned. */
export function shouldScan(path: string): boolean {
  if (basename(path) === "pnpm-lock.yaml") return false;
  return !path.split("/").includes("node_modules");
}

/** Git's heuristic: a NUL byte in the first 8000 bytes means binary. */
export function isBinary(content: Buffer): boolean {
  return content.subarray(0, 8000).includes(0);
}

/** Pure detection: the line numbers (1-based) and rule names of likely secrets in one file. */
export function findSecrets(path: string, content: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const envFile = isEnvFile(path);

  content.split(/\r?\n/).forEach((text, index) => {
    if (text.includes(ALLOW_MARKER)) return;
    const line = index + 1;

    for (const rule of RULES) {
      const matches = [...text.matchAll(rule.pattern)];
      if (matches.some(([match]) => !rule.ignore?.(match))) findings.push({ line, rule: rule.name });
    }

    // References such as `${OTHER_VAR}` are not values.
    const assignment = envFile ? ENV_ASSIGNMENT.exec(text) : null;
    if (assignment && !assignment[2].startsWith("$")) findings.push({ line, rule: "env-secret-assignment" });
  });

  return findings;
}

function git(args: string[]): Buffer {
  return execFileSync("git", args, { maxBuffer: 256 * 1024 * 1024 });
}

function listFiles(all: boolean): string[] {
  // Renamed files are included: a rename can carry new content too.
  const args = all ? ["ls-files", "-z"] : ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"];
  return git(args).toString("utf8").split("\0").filter(Boolean);
}

/** Staged mode reads the index (what will be committed), not the working tree. */
function readContent(path: string, all: boolean): Buffer | null {
  try {
    return all ? readFileSync(path) : git(["show", `:${path}`]);
  } catch {
    return null; // deleted in the working tree, or a submodule
  }
}

function main() {
  const all = process.argv.includes("--all");
  process.chdir(git(["rev-parse", "--show-toplevel"]).toString("utf8").trim());

  const files = listFiles(all).filter(shouldScan);
  const report: string[] = [];
  for (const path of files) {
    const content = readContent(path, all);
    if (!content || isBinary(content)) continue;
    for (const { line, rule } of findSecrets(path, content.toString("utf8"))) {
      report.push(`  ${path}:${line}  ${rule}`);
    }
  }

  const scope = all ? "tracked" : "staged";
  if (report.length === 0) {
    console.log(`check-secrets: no secrets found in ${files.length} ${scope} file(s).`);
    return;
  }
  console.error(
    [
      `check-secrets: possible secrets in ${scope} files (values not shown):`,
      ...report,
      "Remove them and rotate any real key. A verified false positive can be marked with a",
      "`gitleaks:allow` comment on its line.",
    ].join("\n"),
  );
  process.exitCode = 1;
}

// Runs only as a CLI (`tsx scripts/check-secrets.ts`), not when a test imports the functions above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
