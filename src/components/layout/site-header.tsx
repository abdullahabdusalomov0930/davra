import { BookOpenIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

import { MobileNav } from "./mobile-nav";
import { mainNavItems } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";

export async function SiteHeader() {
  const t = await getTranslations("Nav");

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <Link
          href="/"
          className="mr-2 flex items-center gap-2 font-semibold tracking-tight"
          aria-label={t("homeLabel", { appName: siteConfig.name })}
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BookOpenIcon className="size-4" aria-hidden />
          </span>
          <span className="text-lg">{siteConfig.name}</span>
        </Link>

        <nav aria-label={t("mainNav")} className="hidden items-center gap-1 md:flex">
          {mainNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" className="md:hidden">
            <Link href="/qidiruv" aria-label={t("search")}>
              <SearchIcon aria-hidden />
            </Link>
          </Button>
          <ThemeToggle />
          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost">
              <Link href="/kirish">{t("login")}</Link>
            </Button>
            <Button asChild>
              <Link href="/royxatdan-otish">{t("signup")}</Link>
            </Button>
          </div>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
