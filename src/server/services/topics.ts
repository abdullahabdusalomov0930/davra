import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/** All topics in their display order (for selects and filters). Cached per request. */
export const getTopics = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .select("id, slug, name_uz")
    .order("sort_order")
    .order("name_uz");
  if (error) throw error;
  return data;
});

export type Topic = Awaited<ReturnType<typeof getTopics>>[number];

/** Topics with their number of published resources, for /mavzular. */
export async function getTopicsWithCounts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .select("id, slug, name_uz, description_uz, resources(count)")
    .eq("resources.status", "published")
    .order("sort_order")
    .order("name_uz");
  if (error) throw error;
  return data.map(({ resources, ...topic }) => ({ ...topic, resourceCount: resources[0]?.count ?? 0 }));
}

export type TopicWithCount = Awaited<ReturnType<typeof getTopicsWithCounts>>[number];

/** One topic with its number of published resources, or null. */
export const getTopicBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .select("id, slug, name_uz, description_uz, resources(count)")
    .eq("slug", slug)
    .eq("resources.status", "published")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { resources, ...topic } = data;
  return { ...topic, resourceCount: resources[0]?.count ?? 0 };
});
