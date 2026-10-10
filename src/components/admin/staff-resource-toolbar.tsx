import { CheckIcon, EyeOffIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { moderateResourceAction } from "@/server/actions/moderation";
import type { Database } from "@/types/database";

import { ActionButton } from "./action-button";

type Status = Database["public"]["Enums"]["resource_status"];

/** Shown to staff on a resource page: the card's status and the moderation actions that apply. */
export async function StaffResourceToolbar({ resourceId, status }: { resourceId: string; status: Status }) {
  const [t, tStatus] = await Promise.all([getTranslations("Admin"), getTranslations("ResourceStatus")]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed bg-muted/40 px-4 py-3 text-sm">
      <ShieldCheckIcon className="size-4 text-primary" aria-hidden />
      <span className="font-medium">{t("staff.toolbar")}</span>
      <span className="text-muted-foreground">{t("staff.status", { status: tStatus(status) })}</span>
      <div className="ml-auto flex flex-wrap gap-2">
        {status !== "published" && (
          <ActionButton action={moderateResourceAction.bind(null, resourceId, "published")} variant="default">
            <CheckIcon aria-hidden />
            {status === "pending" ? t("resources.approve") : t("resources.restore")}
          </ActionButton>
        )}
        {status === "pending" && (
          <ActionButton
            action={moderateResourceAction.bind(null, resourceId, "rejected")}
            confirm={{ title: t("resources.rejectTitle"), description: t("resources.rejectText") }}
          >
            <XIcon aria-hidden />
            {t("resources.reject")}
          </ActionButton>
        )}
        {status !== "hidden" && (
          <ActionButton
            action={moderateResourceAction.bind(null, resourceId, "hidden")}
            variant="ghost"
            confirm={{ title: t("resources.hideTitle"), description: t("resources.hideText") }}
          >
            <EyeOffIcon aria-hidden />
            {t("resources.hide")}
          </ActionButton>
        )}
      </div>
    </div>
  );
}
