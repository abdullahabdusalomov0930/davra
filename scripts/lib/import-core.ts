/**
 * Shared by scripts/import-resources.ts and scripts/seed-demo.ts: a Supabase client with the secret key
 * (from .env.local, like `next dev`) and the resource import itself. Scripts run outside Next.js, so they
 * cannot use src/server (it is `server-only`).
 */
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import messages from "../../messages/uz.json";
import { type ImportProblem, missingImportColumns, parseImportRecord } from "../../src/lib/resource-import";
import { slugify, withSuffix } from "../../src/lib/slugify";
import { urlTwins } from "../../src/lib/url-normalize";
import type { ResourceData } from "../../src/lib/validators";
import type { Database } from "../../src/types/database";

export type AdminClient = ReturnType<typeof createClient<Database>>;

/** The secret-key client and the host it talks to (printed so nobody imports into the wrong project). */
export function adminClientFromEnv(): { admin: AdminClient; host: string } {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (.env.local).");
  }
  const admin = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { admin, host: new URL(url).host };
}

export function isLocalHost(host: string) {
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
}

function describe(problem: ImportProblem, topics: string[]) {
  if (problem.key === "unknownTopic") return `topic: unknown slug (known: ${topics.join(", ")})`;
  return `${problem.field}: ${messages.Validation[problem.key]}`;
}

export type ImportRecord = { row: number; values: Record<string, string> };

export type ImportSummary = { imported: number; duplicates: number; invalid: number; failed: number };

/**
 * Imports resources as published cards by `authorId`. Every row is checked first with the same rules
 * as the "Resurs qoʻshish" form; if any row is invalid nothing is written. Links that are already on
 * Davracha (in any status, compared like the form does) are skipped, so a file can be imported again.
 */
export async function importRecords(
  admin: AdminClient,
  records: readonly ImportRecord[],
  {
    columns,
    authorId,
    dryRun = false,
    log = console.log,
  }: {
    columns: readonly string[];
    authorId: string;
    dryRun?: boolean;
    log?: (line: string) => void;
  },
): Promise<ImportSummary> {
  const summary: ImportSummary = { imported: 0, duplicates: 0, invalid: 0, failed: 0 };

  const missing = missingImportColumns(columns);
  if (missing.length > 0) throw new Error(`Missing columns: ${missing.join(", ")}`);

  const { data: topics, error: topicsError } = await admin.from("topics").select("id, slug");
  if (topicsError) throw new Error(`Could not load topics: ${topicsError.message}`);
  const topicIds = new Map(topics.map((topic) => [topic.slug, topic.id]));

  // 1. Validate every row.
  const valid: { row: number; data: ResourceData }[] = [];
  for (const record of records) {
    const parsed = parseImportRecord(record.values, topicIds);
    if (parsed.ok) {
      valid.push({ row: record.row, data: parsed.data });
    } else {
      summary.invalid++;
      for (const problem of parsed.problems) log(`  row ${record.row}: ${describe(problem, [...topicIds.keys()])}`);
    }
  }
  if (summary.invalid > 0) {
    log(`${summary.invalid} invalid row(s); nothing was imported. Fix the file and run again.`);
    return summary;
  }

  // 2. Skip links that are already on Davracha or repeated in the file.
  const twins = [...new Set(valid.flatMap(({ data }) => urlTwins(data.url)))];
  const existing = new Set<string>();
  for (let start = 0; start < twins.length; start += 100) {
    const { data, error } = await admin
      .from("resources")
      .select("url")
      .in("url", twins.slice(start, start + 100));
    if (error) throw new Error(`Could not check for duplicates: ${error.message}`);
    for (const { url } of data) existing.add(url);
  }

  // 3. Insert, one row at a time so one failure does not stop the rest.
  for (const { row, data } of valid) {
    if (urlTwins(data.url).some((url) => existing.has(url))) {
      summary.duplicates++;
      log(`  row ${row}: already on Davracha, skipped (${data.url})`);
      continue;
    }
    existing.add(data.url);
    if (dryRun) {
      summary.imported++;
      continue;
    }

    const result = await insertResource(admin, data, authorId);
    if (result === "ok") summary.imported++;
    else {
      summary.failed++;
      log(`  row ${row}: ${result}`);
    }
  }
  return summary;
}

async function insertResource(admin: AdminClient, data: ResourceData, authorId: string): Promise<"ok" | string> {
  const base = slugify(data.title);
  for (let attempt = 0; attempt < 4; attempt++) {
    const { error } = await admin.from("resources").insert({
      slug: attempt === 0 ? base : withSuffix(base),
      author_id: authorId,
      url: data.url,
      title: data.title,
      topic_id: data.topicId,
      type: data.type,
      language: data.language,
      price: data.price,
      level: data.level,
      summary: data.summary,
      for_whom: data.forWhom,
      author_review: data.authorReview,
      status: "published",
    });
    if (!error) return "ok";
    if (error.code === "23505" && error.message.includes("resources_slug_key")) continue;
    if (error.code === "23505") return "already on Davracha (added meanwhile), skipped";
    if (error.message === "blocked_domain") return `${messages.Validation.urlBlocked} (${data.url})`;
    return `insert failed (${error.code ?? error.message})`;
  }
  return "insert failed (no free slug)";
}
