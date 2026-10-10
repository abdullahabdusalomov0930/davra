import {
  BellRingIcon,
  GaugeIcon,
  SearchIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  UserCogIcon,
  UserXIcon,
} from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { AdminEmpty } from "@/components/admin/admin-empty";
import { ModerationButton } from "@/components/admin/moderation-button";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { firstParam } from "@/lib/auth-links";
import { uzDateParts, uzDateTimeParts } from "@/lib/dates";
import { routes } from "@/lib/routes";
import { BAN_LENGTHS } from "@/lib/validators";
import {
  banUserAction,
  setTrustLevelAction,
  setUserRoleAction,
  unbanUserAction,
  warnUserAction,
} from "@/server/actions/moderation";
import { Constants } from "@/types/database";
import { getViewerProfile } from "@/server/auth/session";
import { listUsers } from "@/server/services/admin";

export async function generateMetadata() {
  const t = await getTranslations("Admin");
  return { title: t("nav.users") };
}

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/foydalanuvchilar">) {
  const search = firstParam((await searchParams).q)?.slice(0, 60);
  const [t, tRole, tResource, format, viewer, users] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("UserRole"),
    getTranslations("Resource"),
    getFormatter(),
    getViewerProfile(),
    listUsers(search),
  ]);
  const isAdmin = viewer?.role === "admin";

  return (
    <div className="grid gap-5">
      <form method="get" role="search" className="flex max-w-md gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={search}
          placeholder={t("users.search")}
          aria-label={t("users.search")}
        />
        <Button type="submit" variant="outline">
          <SearchIcon aria-hidden />
          <span className="sr-only sm:not-sr-only">{t("users.searchButton")}</span>
        </Button>
      </form>

      {users.length === 0 ? (
        <AdminEmpty text={t("empty")} />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {users.map((user) => {
            const self = user.id === viewer?.id;
            // Moderators can ban regular users only; admins anyone but themselves (the database decides).
            const canBan = !self && (isAdmin || user.role === "user");
            return (
              <li key={user.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <UserAvatar name={user.display_name} seed={user.username} className="size-9 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link href={routes.profile(user.username)} className="font-medium hover:underline">
                      {user.display_name}
                    </Link>
                    <span className="text-muted-foreground">@{user.username}</span>
                    {self && <span className="text-xs text-muted-foreground">({t("users.you")})</span>}
                    {user.role !== "user" && (
                      <Badge>
                        <ShieldCheckIcon aria-hidden />
                        {tRole(user.role)}
                      </Badge>
                    )}
                    {user.is_banned && (
                      <Badge variant="destructive">
                        {user.banned_until
                          ? t("users.banUntil", {
                              date: tResource("dateTime", uzDateTimeParts(format, user.banned_until)),
                            })
                          : t("users.banPermanent")}
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("users.joined")}: {tResource("date", uzDateParts(format, user.created_at))} · {t("trust.label")}:{" "}
                    {t(`trust.${user.trust_level as 0}`)}
                    {user.trust_level_manual && ` (${t("trust.manual")})`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canBan && !user.is_banned && (
                    <ModerationButton
                      action={banUserAction.bind(null, user.id)}
                      variant="destructive"
                      title={t("users.banTitle")}
                      description={t("users.banText")}
                      withRule
                      choices={{
                        label: t("moderation.choiceLabel"),
                        options: BAN_LENGTHS.map((value) => ({ value, label: t(`users.banLengths.${value}`) })),
                        hint: isAdmin ? undefined : t("users.banHint"),
                      }}
                    >
                      <UserXIcon aria-hidden />
                      {t("users.ban")}
                    </ModerationButton>
                  )}
                  {canBan && user.is_banned && (
                    <ModerationButton
                      action={unbanUserAction.bind(null, user.id)}
                      title={t("users.unbanTitle")}
                      description={t("users.unbanText")}
                      defaultReason={t("moderation.unbanReason")}
                    >
                      <UserCheckIcon aria-hidden />
                      {t("users.unban")}
                    </ModerationButton>
                  )}
                  {!self && (
                    <ModerationButton
                      action={warnUserAction.bind(null, user.id)}
                      variant="ghost"
                      title={t("users.warnTitle")}
                      description={t("users.warnText")}
                      withRule
                    >
                      <BellRingIcon aria-hidden />
                      {t("users.warn")}
                    </ModerationButton>
                  )}
                  {isAdmin && !self && (
                    <ModerationButton
                      action={setTrustLevelAction.bind(null, user.id)}
                      variant="ghost"
                      title={t("trust.title")}
                      description={t("trust.text")}
                      choices={{
                        label: t("trust.label"),
                        options: (["auto", "0", "1", "2", "3"] as const).map((value) => ({
                          value,
                          label: t(`trust.${value}`),
                        })),
                      }}
                    >
                      <GaugeIcon aria-hidden />
                      {t("trust.label")}
                    </ModerationButton>
                  )}
                  {isAdmin && !self && (
                    <ModerationButton
                      action={setUserRoleAction.bind(null, user.id)}
                      variant="ghost"
                      title={t("users.roleTitle")}
                      choices={{
                        label: t("users.role"),
                        options: Constants.public.Enums.user_role.map((value) => ({ value, label: tRole(value) })),
                      }}
                    >
                      <UserCogIcon aria-hidden />
                      {t("users.role")}
                    </ModerationButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
