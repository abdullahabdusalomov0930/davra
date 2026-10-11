import { describe, expect, it } from "vitest";

import { findSecrets, isBinary, isEnvFile, shouldScan } from "../../scripts/check-secrets";

// Fake secrets are assembled at runtime so this file never contains one literally (it is scanned too).
const join = (...parts: string[]) => parts.join("");
const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (claims: Record<string, unknown>) =>
  [b64url({ alg: "HS256", typ: "JWT" }), b64url(claims), "s1gnature-".repeat(4)].join(".");

const fakes = {
  supabase: join("sb_", "secret_", "Fake0Key1".repeat(4)),
  serviceRole: jwt({ iss: "supabase", ref: "abcdefghijklmnopqrst", role: "service_role", exp: 2000000000 }),
  supabaseDemo: jwt({ iss: "supabase-demo", role: "service_role", exp: 1983812996 }),
  aws: join("AKIA", "Z7Q3RT2VWXY4LMNO"),
  awsDocsExample: join("AKIA", "IOSFODNN7", "EXAMPLE"),
  privateKey: join("-----BEGIN ", "RSA PRIVATE KEY", "-----"),
  google: join("AIza", "SyD-", "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P"),
  github: join("ghp", "_", "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8"),
  githubPat: join("github", "_pat_", "11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz"),
  slack: join("xox", "b-", "123456789012-abcdefghijkl"),
};

const rulesIn = (path: string, content: string) => findSecrets(path, content).map(({ rule }) => rule);

describe("findSecrets", () => {
  it.each([
    ["supabase-secret-key", `const key = "${fakes.supabase}";`],
    ["jwt", `SUPABASE_SERVICE_ROLE_KEY: ${fakes.serviceRole}`],
    ["aws-access-key-id", `aws_access_key_id = ${fakes.aws}`],
    ["private-key", fakes.privateKey],
    ["google-api-key", `fetch("https://example.com/?key=${fakes.google}")`],
    ["github-token", `token: ${fakes.github}`],
    ["github-token", `GH_TOKEN=${fakes.githubPat}`],
    ["slack-token", `"${fakes.slack}"`],
  ])("detects %s", (rule, line) => {
    expect(rulesIn("src/example.ts", line)).toEqual([rule]);
  });

  it("reports 1-based line numbers and never the value", () => {
    const findings = findSecrets("src/a.ts", ["// nothing here", "", `const k = "${fakes.supabase}";`].join("\n"));
    expect(findings).toEqual([{ line: 3, rule: "supabase-secret-key" }]);
    expect(JSON.stringify(findings)).not.toContain(fakes.supabase);
  });

  it("ignores the local Supabase demo JWTs and AWS documentation examples", () => {
    expect(rulesIn("README.md", `anon key: ${fakes.supabaseDemo}`)).toEqual([]);
    expect(rulesIn("README.md", `AWS_ACCESS_KEY_ID=${fakes.awsDocsExample}`)).toEqual([]);
  });

  it("does not flag look-alikes that are too short or only mention a prefix", () => {
    const text = [
      "Secret keys start with sb_secret_ and must stay on the server.",
      `const prefix = "${join("sb_", "secret_")}";`,
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test"',
      "Header: eyJhbGciOiJIUzI1NiJ9 (header only)",
      `${join("-----BEGIN ", "PUBLIC KEY", "-----")}`,
    ].join("\n");
    expect(findSecrets("docs/notes.md", text)).toEqual([]);
  });

  it("skips lines marked gitleaks:allow", () => {
    expect(rulesIn("src/a.ts", `const k = "${fakes.github}"; // gitleaks:allow`)).toEqual([]);
  });

  describe("credential assignments in .env files", () => {
    const value = join("f3c9", "a8e2b7d4", "c1e0");

    it("flags SECRET / TOKEN / PASSWORD / API_KEY values of 16+ characters", () => {
      const env = [
        `CRON_SECRET=${value}`,
        `export GITHUB_TOKEN='${value}'`,
        `DB_PASSWORD="${value}"`,
        `SAFE_BROWSING_API_KEY=${value}`,
      ].join("\n");
      expect(findSecrets(".env.local", env)).toEqual(
        [1, 2, 3, 4].map((line) => ({ line, rule: "env-secret-assignment" })),
      );
    });

    it("ignores empty, short and referenced values and non-credential names", () => {
      const env = ["CRON_SECRET=", "CRON_SECRET=short", "CRON_SECRET=${OTHER_SECRET_VALUE}", `SITE_URL=${value}`];
      expect(findSecrets(".env.production", env.join("\n"))).toEqual([]);
    });

    it("applies to .env files only, and not to the committed template", () => {
      expect(rulesIn("ci.env", `CRON_SECRET=${value}`)).toEqual(["env-secret-assignment"]);
      expect(rulesIn(".env.example", `CRON_SECRET=${value}`)).toEqual([]);
      expect(rulesIn("src/config.ts", `CRON_SECRET=${value}`)).toEqual([]);
    });

    it("still applies the specific rules to the template", () => {
      expect(rulesIn(".env.example", `SUPABASE_SECRET_KEY=${fakes.supabase}`)).toEqual(["supabase-secret-key"]);
    });
  });
});

describe("file selection", () => {
  it("recognises .env files", () => {
    expect([".env", ".env.local", "apps/web/.env.production", "ci.env"].every(isEnvFile)).toBe(true);
    expect([".env.example", "src/lib/env.ts", "environment.md"].some(isEnvFile)).toBe(false);
  });

  it("skips the lockfile and node_modules", () => {
    expect(shouldScan("pnpm-lock.yaml")).toBe(false);
    expect(shouldScan("node_modules/pkg/index.js")).toBe(false);
    expect(shouldScan("packages/a/node_modules/pkg/index.js")).toBe(false);
    expect(shouldScan("scripts/check-secrets.ts")).toBe(true);
  });

  it("treats content with a NUL byte as binary", () => {
    expect(isBinary(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]))).toBe(true);
    expect(isBinary(Buffer.from("plain text"))).toBe(false);
  });
});
