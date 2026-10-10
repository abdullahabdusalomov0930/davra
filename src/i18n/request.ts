import { getRequestConfig } from "next-intl/server";

import { TIME_ZONE } from "@/lib/config";

import { defaultLocale } from "./config";

// Single-locale setup without i18n routing: URLs stay Uzbek (/mavzular, /kirish, ...).
// When Russian is added, resolve the locale from a cookie here.
export default getRequestConfig(async () => {
  const locale = defaultLocale;

  return {
    locale,
    timeZone: TIME_ZONE,
    // One "now" per request, shared with client components, so relative dates ("3 kun oldin")
    // render the same on the server and during hydration.
    now: new Date(),
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
