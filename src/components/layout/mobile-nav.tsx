"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { mainNavItems } from "./nav-items";

export function MobileNav() {
  const t = useTranslations("Nav");

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("openMenu")}>
          <MenuIcon aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" closeLabel={t("closeMenu")} className="w-72">
        <SheetHeader>
          <SheetTitle>{t("menuTitle")}</SheetTitle>
        </SheetHeader>
        <nav aria-label={t("mainNav")} className="flex flex-col gap-1 px-4">
          {mainNavItems.map((item) => (
            <SheetClose asChild key={item.href}>
              <Link href={item.href} className="rounded-md px-3 py-2.5 text-base font-medium hover:bg-accent">
                {t(item.labelKey)}
              </Link>
            </SheetClose>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t p-4">
          <SheetClose asChild>
            <Button asChild variant="outline">
              <Link href="/kirish">{t("login")}</Link>
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button asChild>
              <Link href="/royxatdan-otish">{t("signup")}</Link>
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
