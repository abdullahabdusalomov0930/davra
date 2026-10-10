import { type ResourceData, type ResourceInput, resourceSchema, type ValidationKey } from "@/lib/validators";

/**
 * Columns of a resource import file (scripts/import-resources.ts). `topic` is a topic slug
 * (e.g. "dasturlash"); the enum columns take the database values (type "video", language "uz",
 * price "free", level "beginner"). `author_review` may be empty.
 */
export const IMPORT_COLUMNS = [
  "title",
  "url",
  "topic",
  "type",
  "language",
  "price",
  "level",
  "summary",
  "for_whom",
  "author_review",
] as const;

const REQUIRED_COLUMNS = IMPORT_COLUMNS.filter((column) => column !== "author_review");

/** Required columns missing from the header row. */
export function missingImportColumns(columns: readonly string[]): string[] {
  return REQUIRED_COLUMNS.filter((column) => !columns.includes(column));
}

export type ImportProblem = { field: string; key: ValidationKey | "unknownTopic" };

export type ParsedImportRow = { ok: true; data: ResourceData } | { ok: false; problems: ImportProblem[] };

/** One file row checked with the same rules as the "Resurs qoʻshish" form. */
export function parseImportRecord(
  values: Record<string, string>,
  topicIds: ReadonlyMap<string, string>,
): ParsedImportRow {
  const topicId = topicIds.get(values.topic?.trim() ?? "");
  const input: ResourceInput = {
    title: values.title ?? "",
    url: values.url ?? "",
    topicId: topicId ?? "",
    type: values.type?.trim() as ResourceInput["type"],
    language: values.language?.trim() as ResourceInput["language"],
    price: values.price?.trim() as ResourceInput["price"],
    level: values.level?.trim() as ResourceInput["level"],
    summary: values.summary ?? "",
    forWhom: values.for_whom ?? "",
    authorReview: values.author_review ?? "",
  };

  const parsed = resourceSchema.safeParse(input);
  const problems: ImportProblem[] = parsed.success
    ? []
    : parsed.error.issues.map((issue) => ({
        field: String(issue.path[0] ?? ""),
        key: issue.message as ValidationKey,
      }));
  if (!topicId) {
    return {
      ok: false,
      problems: [{ field: "topic", key: "unknownTopic" }, ...problems.filter((p) => p.field !== "topicId")],
    };
  }
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, problems };
}
