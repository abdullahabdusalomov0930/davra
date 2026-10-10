import { BanIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { AppealButton } from "@/components/notifications/appeal-button";
import { uzDateTimeParts } from "@/lib/dates";

type Ban = { banned_until: string | null; ban_reason: string | null };

/** Shown to a banned user on every page: until when, why, and the way to appeal. */
export async function BanNotice({ ban, userId }: { ban: Ban; userId?: string }) {
  const [t, tResource, format] = await Promise.all([
    getTranslations("Banned"),
    getTranslations("Resource"),
    getFormatter(),
  ]);
  return (
    <div role="status" className="border-t border-destructive/30 bg-destructive/10 text-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        <BanIcon className="size-4 text-destructive" aria-hidden />
        <p className="min-w-0 flex-1">
          <span className="font-medium">{t("title")}.</span>{" "}
          {ban.banned_until
            ? t("until", { date: tResource("dateTime", uzDateTimeParts(format, ban.banned_until)) })
            : t("permanent")}{" "}
          {ban.ban_reason && t("reason", { reason: ban.ban_reason })} {t("text")}
        </p>
        {userId && <AppealButton targetType="ban" targetId={userId} />}
      </div>
    </div>
  );
}
