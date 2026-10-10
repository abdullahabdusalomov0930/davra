import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";

import { defaultLocale } from "@/i18n/config";
import { brandColors } from "@/lib/brand";
import { siteConfig } from "@/lib/site-config";

/** Web app manifest: "Add to home screen" opens Davra like an app. Icons come from `pnpm icons`. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations({ locale: defaultLocale, namespace: "Metadata" });

  return {
    name: t("title", { appName: siteConfig.name }),
    short_name: siteConfig.name,
    description: t("description"),
    lang: defaultLocale,
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: brandColors.background,
    theme_color: brandColors.background,
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
