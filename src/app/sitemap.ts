import type { MetadataRoute } from "next";

import { routes } from "@/lib/routes";
import { absoluteUrl } from "@/lib/seo";
import { listSitemapEntries } from "@/server/services/public-data";

// Built on each request from what guests can see, so it never needs a rebuild and never reaches the
// database during `next build`. Crawlers fetch it rarely.
export const dynamic = "force-dynamic";

const STATIC_PAGES: { path: string; changeFrequency: "daily" | "weekly" | "yearly"; priority: number }[] = [
  { path: routes.home, changeFrequency: "daily", priority: 1 },
  { path: routes.topics, changeFrequency: "weekly", priority: 0.8 },
  { path: routes.weekly, changeFrequency: "daily", priority: 0.8 },
  { path: routes.search, changeFrequency: "weekly", priority: 0.5 },
  { path: routes.rules, changeFrequency: "yearly", priority: 0.3 },
  { path: routes.terms, changeFrequency: "yearly", priority: 0.3 },
  { path: routes.privacy, changeFrequency: "yearly", priority: 0.3 },
  { path: routes.removalRequest, changeFrequency: "yearly", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { resources, topics, profiles } = await listSitemapEntries();

  return [
    ...STATIC_PAGES.map(({ path, changeFrequency, priority }) => ({
      url: absoluteUrl(path),
      changeFrequency,
      priority,
    })),
    ...topics.map((slug) => ({
      url: absoluteUrl(routes.topic(slug)),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...resources.map(({ slug, updatedAt }) => ({
      url: absoluteUrl(routes.resource(slug)),
      lastModified: updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...profiles.map(({ username, updatedAt }) => ({
      url: absoluteUrl(routes.profile(username)),
      lastModified: updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ];
}
