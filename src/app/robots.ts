import type { MetadataRoute } from "next";

import { routes } from "@/lib/routes";
import { absoluteUrl } from "@/lib/seo";

/** Public pages are open to crawlers; account, admin and API paths are not. Previews are closed. */
export default function robots(): MetadataRoute.Robots {
  const isPreview = Boolean(process.env.VERCEL_ENV) && process.env.VERCEL_ENV !== "production";
  if (isPreview) return { rules: { userAgent: "*", disallow: "/" } };

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        routes.admin,
        "/api/",
        routes.settings,
        routes.saved,
        routes.following,
        routes.newResource,
        routes.notifications,
        "/resurs/*/tahrirlash",
        "/tashqi/",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
