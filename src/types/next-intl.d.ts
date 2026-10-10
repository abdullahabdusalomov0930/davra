import type messages from "../../messages/uz.json";
import type { Locale } from "@/i18n/config";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
