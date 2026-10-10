/**
 * Bulk import of resources from a CSV file (cold start, brief 6.1). Rows become published cards shared
 * by a staff account. Columns: see IMPORT_COLUMNS in src/lib/resource-import.ts and README "Importing
 * resources". Every row is validated like the web form; nothing is written if any row is invalid.
 *
 *   pnpm import:resources <file.csv> --author <username> [--dry-run]
 */
import { readFile } from "node:fs/promises";

import { parseCsvRecords } from "../src/lib/csv";

import { adminClientFromEnv, importRecords } from "./lib/import-core";

function usage(): never {
  console.error("Usage: pnpm import:resources <file.csv> --author <username> [--dry-run]");
  process.exit(2);
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((arg) => !arg.startsWith("--") && args[args.indexOf(arg) - 1] !== "--author");
  const author = args[args.indexOf("--author") + 1];
  const dryRun = args.includes("--dry-run");
  if (!file || !args.includes("--author") || !author || author.startsWith("--")) usage();

  const { admin, host } = adminClientFromEnv();
  console.log(`${dryRun ? "Checking" : "Importing"} ${file} into ${host} as @${author}`);

  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, role, is_banned")
    .eq("username", author.toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`Could not load @${author}: ${error.message}`);
  // Imported cards skip moderation, so they are shared in a staff member's name.
  if (!profile || profile.is_banned || profile.role === "user") {
    throw new Error(`@${author} must be an existing moderator or admin.`);
  }

  const { columns, records } = parseCsvRecords(await readFile(file, "utf8"));
  const summary = await importRecords(admin, records, { columns, authorId: profile.id, dryRun });

  console.log(
    `${dryRun ? "Would import" : "Imported"} ${summary.imported}, skipped ${summary.duplicates} duplicate(s), ` +
      `${summary.invalid} invalid, ${summary.failed} failed.`,
  );
  if (summary.invalid > 0 || summary.failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
