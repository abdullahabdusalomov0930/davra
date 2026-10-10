import { getFormatter, getTranslations } from "next-intl/server";

import { averageRating } from "@/components/resources/resource-meta";
import { defaultLocale } from "@/i18n/config";
import { renderShareImage, SHARE_IMAGE_SIZE } from "@/server/og/share-image";
import { getShareableResource } from "@/server/services/public-data";

// A resource's share image (Telegram, X, …): topic, title, site, type, language and rating.
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";
// Titles and ratings change; an hour-old picture is fine.
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = defaultLocale;
  const [resource, format, tType, tLanguage, tHome, tMeta] = await Promise.all([
    getShareableResource(slug),
    getFormatter({ locale }),
    getTranslations({ locale, namespace: "ResourceType" }),
    getTranslations({ locale, namespace: "ResourceLanguage" }),
    getTranslations({ locale, namespace: "Home" }),
    getTranslations({ locale, namespace: "Metadata" }),
  ]);

  // Not public (pending, hidden, deleted): the site's own picture.
  if (!resource) return renderShareImage({ title: tHome("heroTitle"), subtitle: tMeta("description") });

  const average = averageRating(resource.ratings_sum, resource.ratings_count);
  return renderShareImage({
    eyebrow: resource.topic.name_uz,
    title: resource.title,
    details: [resource.domain, tType(resource.type), tLanguage(resource.language)],
    rating:
      average === null
        ? undefined
        : `${format.number(average, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${format.number(resource.ratings_count)})`,
  });
}
