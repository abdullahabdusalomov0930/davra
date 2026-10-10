import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { APP_NAME } from "@/lib/config";

import { legalNavItems } from "./nav-items";

export async function SiteFooter() {
  const t = await getTranslations("Footer");

  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-1">
          <p className="font-semibold">{APP_NAME}</p>
          <p className="text-sm text-muted-foreground">{t("tagline")}</p>
        </div>
        <nav aria-label={t("legalNav")}>
          <ul className="grid gap-2 text-sm sm:grid-cols-2 sm:gap-x-8">
            {legalNavItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-muted-foreground hover:text-foreground hover:underline">
                  {t(item.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted-foreground">
        {t("copyright", { year: new Date().getFullYear(), appName: APP_NAME })}
      </div>
    </footer>
  );
}
