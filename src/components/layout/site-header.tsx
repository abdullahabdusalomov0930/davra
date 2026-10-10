import { BookOpenIcon, PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { siteConfig } from "@/lib/site-config";
import { getViewerProfile } from "@/server/auth/session";

import { MobileNav } from "./mobile-nav";
import { mainNavItems } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";
import { type HeaderUser, UserMenu } from "./user-menu";

export async function SiteHeader() {
  const [t, profile] = await Promise.all([getTranslations("Nav"), getViewerProfile()]);
  const user: HeaderUser | null = profile && {
    username: profile.username,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
  };

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
            <Link href={routes.search} aria-label={t("search")}>
              <SearchIcon aria-hidden />
            </Link>
          </Button>
          <ThemeToggle />
          {user ? (
            <>
              <Button asChild size="sm" className="mx-1">
                <Link href={routes.newResource}>
                  <PlusIcon aria-hidden />
                  <span className="sr-only sm:not-sr-only">{t("share")}</span>
                </Link>
              </Button>
              <UserMenu user={user} />
            </>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Button asChild variant="ghost">
                <Link href={routes.signIn}>{t("login")}</Link>
              </Button>
              <Button asChild>
                <Link href={routes.signUp}>{t("signup")}</Link>
              </Button>
            </div>
          )}
          <MobileNav signedIn={Boolean(user)} />
        </div>
      </div>
    </header>
  );
}
