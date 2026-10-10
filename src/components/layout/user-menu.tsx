"use client";

import { LogOutIcon, SettingsIcon, UserIcon } from "lucide-react";
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

export type HeaderUser = { username: string; displayName: string; avatarUrl: string | null };

export function UserMenu({ user }: { user: HeaderUser }) {
  const t = useTranslations("Nav");
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={t("userMenu")}>
          <UserAvatar name={user.displayName} src={user.avatarUrl} className="size-8 text-xs" />
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
