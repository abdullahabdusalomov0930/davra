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
        // An ink strip above the header, like a note pinned to the page: what is new this week.
        <aside aria-label={t("announcementLabel")} className="dark bg-night text-night-foreground">
          <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-1.5 px-4 py-2 text-center text-[13px] font-medium">
            {t("announcement")}
            <Link
              href={routes.weekly}
              className="group inline-flex items-center gap-1 font-semibold text-marker underline-offset-4 hover:underline"
            >
              {t("announcementLink")}
              <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </p>
        </aside>
      )}
      <header className="sticky top-0 z-40 border-b-2 border-foreground bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="frame flex h-[4.25rem] items-center gap-2 px-4 sm:px-8 lg:px-12">
          <Link
            href="/"
            className="group/logo mr-5 flex items-center rounded-xl"
            aria-label={t("homeLabel", { appName: APP_NAME })}
          >
            <Logo />
          </Link>

          <nav aria-label={t("mainNav")} className="hidden items-center gap-0.5 md:flex">
            {mainNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-[15px] font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
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
                        className="absolute top-0 right-0 flex min-w-4 items-center justify-center rounded-full border-[1.5px] border-background bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground"
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
