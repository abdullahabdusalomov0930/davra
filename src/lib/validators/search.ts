import { z } from "@/lib/zod";

import { RESOURCE_LANGUAGES, RESOURCE_LEVELS, RESOURCE_PRICES, RESOURCE_TYPES } from "./resource";

export const SEARCH_QUERY_MAX = 100;

/** How a resource list is ordered (the values `search_resources` accepts). */
export const FEED_SORTS = ["relevance", "newest", "popular", "top"] as const;
export type FeedSort = (typeof FEED_SORTS)[number];

/** A resource list request: what the feed, topic pages and search send to the server. */
export const feedQuerySchema = z.strictObject({
  text: z.string().trim().max(SEARCH_QUERY_MAX).optional(),
  topicId: z.uuid().optional(),
  type: z.enum(RESOURCE_TYPES).optional(),
  language: z.enum(RESOURCE_LANGUAGES).optional(),
  price: z.enum(RESOURCE_PRICES).optional(),
  level: z.enum(RESOURCE_LEVELS).optional(),
  sort: z.enum(FEED_SORTS),
  /** Only resources from the people and topics the visitor follows ("Obunalarim"). */
  following: z.boolean().optional(),
});

export type FeedQuery = z.infer<typeof feedQuerySchema>;

/** Uzbek names in URLs: /qidiruv?q=python&mavzu=dasturlash&tur=video&tartib=yangi. */
export const SEARCH_PARAMS = {
  query: "q",
  topic: "mavzu",
  type: "tur",
  language: "til",
  price: "narx",
  level: "daraja",
  sort: "tartib",
  cursor: "keyin",
} as const;

/** URL values of `tartib`. */
export const SORT_PARAM_VALUES = {
  relevance: "mos",
  newest: "yangi",
  popular: "mashhur",
  top: "baho",
} as const satisfies Record<FeedSort, string>;

export type SortParam = (typeof SORT_PARAM_VALUES)[FeedSort];

export function sortFromParam(value: string | undefined): FeedSort | undefined {
  return FEED_SORTS.find((sort) => SORT_PARAM_VALUES[sort] === value);
}

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Keeps a value only when the schema accepts it: a bad filter in a shared link is ignored, not an error. */
function pick<T>(schema: z.ZodType<T>, value: string | undefined): T | undefined {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

const topicSlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(60);

/** The search page's URL parameters, cleaned. Unknown or invalid values are dropped. */
export function parseSearchParams(params: RawParams) {
  const text = first(params[SEARCH_PARAMS.query])?.trim().slice(0, SEARCH_QUERY_MAX) || undefined;
  return {
    text,
    topic: pick(topicSlugSchema, first(params[SEARCH_PARAMS.topic])),
    type: pick(z.enum(RESOURCE_TYPES), first(params[SEARCH_PARAMS.type])),
    language: pick(z.enum(RESOURCE_LANGUAGES), first(params[SEARCH_PARAMS.language])),
    price: pick(z.enum(RESOURCE_PRICES), first(params[SEARCH_PARAMS.price])),
    level: pick(z.enum(RESOURCE_LEVELS), first(params[SEARCH_PARAMS.level])),
    sort: sortFromParam(first(params[SEARCH_PARAMS.sort])),
    cursor: first(params[SEARCH_PARAMS.cursor]),
  };
}

export type SearchParams = ReturnType<typeof parseSearchParams>;

/** The search page's sort when the URL names none: best match for a query, otherwise newest. */
export function defaultSearchSort(text: string | undefined): FeedSort {
  return text?.trim() ? "relevance" : "newest";
}

type SearchValues = {
  text?: string;
  topic?: string;
  type?: string;
  language?: string;
  price?: string;
  level?: string;
  sort?: FeedSort;
  cursor?: string;
};

/** Builds a query string from search values, leaving out empty ones and the default sort. */
export function toSearchQueryString(values: SearchValues): string {
  const params = new URLSearchParams();
  const entries: [string, string | undefined][] = [
    [SEARCH_PARAMS.query, values.text],
    [SEARCH_PARAMS.topic, values.topic],
    [SEARCH_PARAMS.type, values.type],
    [SEARCH_PARAMS.language, values.language],
    [SEARCH_PARAMS.price, values.price],
    [SEARCH_PARAMS.level, values.level],
    [
      SEARCH_PARAMS.sort,
      values.sort && values.sort !== defaultSearchSort(values.text) ? SORT_PARAM_VALUES[values.sort] : undefined,
    ],
    [SEARCH_PARAMS.cursor, values.cursor],
  ];
  for (const [key, value] of entries) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `?${query}` : "";
}
