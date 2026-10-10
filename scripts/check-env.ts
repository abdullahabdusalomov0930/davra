/**
 * Runs before `next build` (see the `build` script). A missing or malformed variable would otherwise
 * build fine and then make every request fail with a bare "Internal Server Error", so the build fails
 * here with the variable's name instead. Values are never printed.
 */
import { loadEnvConfig } from "@next/env";

import { publicEnvSchema, readPublicEnv } from "../src/lib/env";

// Same files and precedence as `next build` (.env.production.local, .env.local, ...).
loadEnvConfig(process.cwd());

const problems: string[] = [];

const publicEnv = publicEnvSchema.safeParse(readPublicEnv());
if (!publicEnv.success) {
  for (const issue of publicEnv.error.issues) problems.push(`${issue.path.join(".")}: ${issue.message}`);
}

if (!process.env.SUPABASE_SECRET_KEY?.trim()) {
  problems.push("SUPABASE_SECRET_KEY: missing");
}

// Production must not fall back to http://localhost:3000 (canonical URLs, auth redirects).
if (process.env.VERCEL_ENV === "production" && !process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
  problems.push("NEXT_PUBLIC_SITE_URL: required in production");
}

// Not fatal: the site works without it, only the scheduled link check does not run.
if (process.env.VERCEL_ENV === "production" && (process.env.CRON_SECRET?.trim().length ?? 0) < 16) {
  console.warn("CRON_SECRET: missing or shorter than 16 characters; the link check cron will be refused.");
}

if (problems.length > 0) {
  console.error(
    [
      "Invalid environment variables:",
      ...problems.map((problem) => `  - ${problem}`),
      "Locally: compare .env.local with .env.example.",
      "On Vercel: Project → Settings → Environment Variables, fix the value, then redeploy.",
    ].join("\n"),
  );
  process.exit(1);
}

console.log("Environment variables OK");
