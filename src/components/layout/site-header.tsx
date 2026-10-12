import { ArrowRightIcon, BellIcon, PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { APP_NAME } from "@/lib/config";
import { getViewerProfile } from "@/server/auth/session";
import { countUnreadNotifications, getMyBan, listAppealedTargets } from "@/server/services/notifications";

import { MobileNav } from "./mobile-nav";
import { mainNavItems } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";
import { BanNotice } from "./ban-notice";
import { Logo } from "./logo";
import { type HeaderUser, UserMenu } from "./user-menu";

export async function SiteHeader() {
  const [t, tNotifications, profile] = await Promise.all([
    getTranslations("Nav"),
    getTranslations("Notifications"),
    getViewerProfile(),
  ]);
  const [unread, ban, appealed] = profile
    ? await Promise.all([
        countUnreadNotifications(),
        profile.is_banned ? getMyBan(profile.id) : null,
        profile.is_banned ? listAppealedTargets() : null,
      ])
    : [0, null, null];
  const user: HeaderUser | null = profile && {
    username: profile.username,
    displayName: profile.display_name,
    isStaff: !profile.is_banned && profile.role !== "user",
  };

  return (
    <>
      {!user && (
        // A dark strip above the header, like a press note: what is new this week.
        <aside aria-label={t("announcementLabel")} className="dark bg-night text-night-foreground">
          <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-1.5 px-4 py-2 text-center text-[13px] font-medium">
            {t("announcement")}
            <Link
              href={routes.weekly}
              className="group inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
            >
              {t("announcementLink")}
              <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </p>
        </aside>
      )}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
          <Link
            href="/"
            className="group/logo mr-4 flex items-center rounded-full"
            aria-label={t("homeLabel", { appName: APP_NAME })}
          >
            <Logo />
          </Link>

          <nav aria-label={t("mainNav")} className="hidden items-center gap-0.5 md:flex">
            {mainNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3.5 py-2 text-[15px] font-medium text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground"
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <Button asChild variant="ghost" size="icon" className="md:hidden">
              <Link href={routes.search} aria-label={t("search")}>
                <SearchIcon aria-hidden />
              </Link>
            </Button>
            <ThemeToggle />
            {user ? (
              <>
                <Button asChild className="mx-1">
                  <Link href={routes.newResource}>
                    <PlusIcon aria-hidden />
                    <span className="sr-only sm:not-sr-only">{t("share")}</span>
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="icon" className="relative">
                  <Link
                    href={routes.notifications}
                    aria-label={`${tNotifications("navLabel")}: ${tNotifications("unread", { count: unread })}`}
                  >
                    <BellIcon aria-hidden />
                    {unread > 0 && (
                      <span
                        aria-hidden
                        className="absolute top-0.5 right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground"
                      >
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </Link>
                </Button>
                <UserMenu user={user} />
              </>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <Button asChild variant="outline">
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
        {ban && profile && <BanNotice ban={ban} userId={appealed?.has(`ban:${profile.id}`) ? undefined : profile.id} />}
      </header>
    </>
  );
}
