"use client";

import { BookmarkIcon, LogOutIcon, RssIcon, SettingsIcon, ShieldCheckIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { UserAvatar } from "@/components/profile/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { routes } from "@/lib/routes";
import { signOutAction } from "@/server/actions/auth";

export type HeaderUser = { username: string; displayName: string; isStaff: boolean };

export function UserMenu({ user }: { user: HeaderUser }) {
  const t = useTranslations("Nav");
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={t("userMenu")}>
          <UserAvatar name={user.displayName} seed={user.username} className="size-8 text-xs" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="grid gap-0.5">
          <span className="truncate">{user.displayName}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">@{user.username}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={routes.profile(user.username)}>
            <UserIcon aria-hidden />
            {t("profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={routes.saved}>
            <BookmarkIcon aria-hidden />
            {t("saved")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={routes.following}>
            <RssIcon aria-hidden />
            {t("following")}
          </Link>
        </DropdownMenuItem>
        {user.isStaff && (
          <DropdownMenuItem asChild>
            <Link href={routes.admin}>
              <ShieldCheckIcon aria-hidden />
              {t("moderation")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={routes.settings}>
            <SettingsIcon aria-hidden />
            {t("settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onSelect={(event) => {
            event.preventDefault();
            startTransition(() => signOutAction());
          }}
        >
          <LogOutIcon aria-hidden />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
