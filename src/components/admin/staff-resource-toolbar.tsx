import { ShieldCheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { Database } from "@/types/database";

import { ResourceModeration } from "./resource-moderation";

type Status = Database["public"]["Enums"]["resource_status"];

/** Shown to staff on a resource page: the card's status and the moderation actions that apply. */
export async function StaffResourceToolbar({
  resourceId,
  status,
  domain,
  isAdmin,
}: {
  resourceId: string;
  status: Status;
  domain: string;
  isAdmin: boolean;
}) {
  const [t, tStatus] = await Promise.all([getTranslations("Admin"), getTranslations("ResourceStatus")]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed bg-muted/40 px-4 py-3 text-sm">
      <ShieldCheckIcon className="size-4 text-primary" aria-hidden />
      <span className="font-medium">{t("staff.toolbar")}</span>
      <span className="text-muted-foreground">{t("staff.status", { status: tStatus(status) })}</span>
      <div className="ml-auto">
        <ResourceModeration resourceId={resourceId} status={status} domain={domain} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
