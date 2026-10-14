import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { APP_NAME } from "@/lib/config";

import { LogoMark } from "./logo";
import { legalNavItems, mainNavItems } from "./nav-items";

export async function SiteFooter() {
  const [t, tNav] = await Promise.all([getTranslations("Footer"), getTranslations("Nav")]);

  const linkClass = "text-night-foreground/75 transition-colors hover:text-night-foreground hover:underline";

  return (
    <footer className="dark relative overflow-hidden border-t-2 border-foreground bg-night text-night-foreground">
      <div className="frame grid gap-10 px-4 pt-16 pb-10 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr] lg:px-12">
        <div className="max-w-sm">
          <p className="flex items-center gap-2.5 font-heading text-2xl font-extrabold tracking-[-0.02em]">
            <LogoMark className="size-9" />
            {APP_NAME.toLowerCase()}
          </p>
          <p className="mt-3 text-sm text-pretty text-night-foreground/75">{t("tagline")}</p>
        </div>
        <nav aria-label={t("siteNav")}>
          <ul className="grid gap-2.5 text-sm">
            {mainNavItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {tNav(item.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={t("legalNav")}>
          <ul className="grid gap-2.5 text-sm">
            {legalNavItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {t(item.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* The name as a large, quiet wordmark along the bottom edge. Pure decoration (drawn as generated
          content, so it is neither read out nor part of the text). */}
      <div
        aria-hidden
        data-wordmark={APP_NAME.toLowerCase()}
        className="pointer-events-none frame px-4 font-heading text-[clamp(3rem,12.5vw,10rem)] leading-[0.85] font-extrabold tracking-[-0.04em] text-night-foreground/[0.07] select-none after:content-[attr(data-wordmark)] sm:px-8 lg:px-12"
      />

      <div className="border-t border-white/10">
        <p className="frame px-4 py-5 text-xs text-night-foreground/75 sm:px-8 lg:px-12">
          {t("copyright", { year: new Date().getFullYear(), appName: APP_NAME })}
        </p>
      </div>
    </footer>
  );
}
