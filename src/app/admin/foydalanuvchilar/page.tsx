import { SearchIcon, ShieldCheckIcon, UserCheckIcon, UserXIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { ActionButton } from "@/components/admin/action-button";
import { AdminEmpty } from "@/components/admin/admin-empty";
import { RoleSelect } from "@/components/admin/role-select";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { firstParam } from "@/lib/auth-links";
import { uzDateParts } from "@/lib/dates";
import { routes } from "@/lib/routes";
import { setUserBanAction } from "@/server/actions/moderation";
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
                <UserAvatar name={user.display_name} src={user.avatar_url} className="size-9 text-xs" />
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
                    {user.is_banned && <Badge variant="destructive">{t("users.banned")}</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("users.joined")}: {tResource("date", uzDateParts(format, user.created_at))}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isAdmin && !self && <RoleSelect userId={user.id} role={user.role} label={t("users.role")} />}
                  {canBan &&
                    (user.is_banned ? (
                      <ActionButton action={setUserBanAction.bind(null, user.id, false)}>
                        <UserCheckIcon aria-hidden />
                        {t("users.unban")}
                      </ActionButton>
                    ) : (
                      <ActionButton
                        action={setUserBanAction.bind(null, user.id, true)}
                        variant="destructive"
                        confirm={{ title: t("users.banTitle"), description: t("users.banText") }}
                      >
                        <UserXIcon aria-hidden />
                        {t("users.ban")}
                      </ActionButton>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
