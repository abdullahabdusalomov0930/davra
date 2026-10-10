import { getTranslations } from "next-intl/server";

import { defaultLocale } from "@/i18n/config";
import { siteConfig } from "@/lib/site-config";
import { renderShareImage, SHARE_IMAGE_SIZE } from "@/server/og/share-image";

// The share image for every page without its own (home, topics, profiles, …).
export const alt = siteConfig.name;
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const t = await getTranslations({ locale: defaultLocale, namespace: "Home" });
  const tMeta = await getTranslations({ locale: defaultLocale, namespace: "Metadata" });
  return renderShareImage({ title: t("heroTitle"), subtitle: tMeta("description") });
}
