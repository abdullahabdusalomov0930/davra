import "server-only";

import { createGuestClient } from "@/lib/supabase/guest";

// What a signed-out visitor can see, whoever asks: share images and the sitemap are public outputs
// and must not depend on the current viewer (an author sees their pending cards, staff see everything).

/** A published resource's facts for its share image, or null. */
export async function getShareableResource(slug: string) {
  const { data, error } = await createGuestClient()
    .from("resources")
    .select("title, domain, type, language, ratings_sum, ratings_count, topic:topics (name_uz)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** The sitemap allows 50 000 URLs per file; far more than the MVP will have. */
const SITEMAP_LIMIT = 10_000;

/** Published resources, topics, and the profiles of people who shared something. */
export async function listSitemapEntries() {
  const supabase = createGuestClient();
  const [resources, topics] = await Promise.all([
    supabase
      .from("resources")
      .select("slug, updated_at, author:profiles!resources_author_id_fkey (username)")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(SITEMAP_LIMIT),
    supabase.from("topics").select("slug").order("sort_order"),
  ]);
  if (resources.error) throw resources.error;
  if (topics.error) throw topics.error;

  const authors = new Map<string, Date>();
  for (const { author, updated_at } of resources.data) {
    const updated = new Date(updated_at);
    const latest = authors.get(author.username);
    if (!latest || updated > latest) authors.set(author.username, updated);
  }

  return {
    resources: resources.data.map(({ slug, updated_at }) => ({ slug, updatedAt: new Date(updated_at) })),
    topics: topics.data.map(({ slug }) => slug),
    profiles: [...authors].map(([username, updatedAt]) => ({ username, updatedAt })),
  };
}
