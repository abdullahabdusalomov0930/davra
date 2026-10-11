import { BanIcon, CheckIcon, EyeOffIcon, RotateCcwIcon, Trash2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { deleteContentAction, moderateResourceAction } from "@/server/actions/moderation";
import type { Database } from "@/types/database";

import { ModerationButton } from "./moderation-button";

type Status = Database["public"]["Enums"]["resource_status"];

/**
 * The moderation actions that apply to a card in its status. Each asks for a reason (D71). Deleting
 * is for admins; a moderator's "delete" asks an admin to confirm it.
 */
export async function ResourceModeration({
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
  const t = await getTranslations("Admin");

  return (
    <div className="flex flex-wrap gap-2">
      {status === "pending" && (
        <ModerationButton
          action={moderateResourceAction.bind(null, resourceId, "published")}
          variant="default"
          title={t("resources.approveTitle")}
          defaultReason={t("moderation.approveReason")}
        >
          <CheckIcon aria-hidden />
          {t("resources.approve")}
        </ModerationButton>
      )}
      {(status === "hidden" || status === "rejected") && (
        <ModerationButton
          action={moderateResourceAction.bind(null, resourceId, "published")}
          title={t("resources.restoreTitle")}
          defaultReason={t("moderation.restoreReason")}
        >
          <RotateCcwIcon aria-hidden />
          {t("resources.restore")}
        </ModerationButton>
      )}
      {status === "pending" && (
        <ModerationButton
          action={moderateResourceAction.bind(null, resourceId, "rejected")}
          title={t("resources.rejectTitle")}
          description={t("resources.rejectText")}
          withRule
        >
          <XIcon aria-hidden />
          {t("resources.reject")}
        </ModerationButton>
      )}
      {status !== "hidden" && status !== "rejected" && (
        <ModerationButton
          action={moderateResourceAction.bind(null, resourceId, "hidden")}
          variant="ghost"
          title={t("resources.hideTitle")}
          description={t("resources.hideText")}
          withRule
        >
          <EyeOffIcon aria-hidden />
          {t("resources.hide")}
        </ModerationButton>
      )}
      <ModerationButton
        action={deleteContentAction.bind(null, "resource", resourceId)}
        variant="ghost"
        title={isAdmin ? t("content.deleteTitle") : t("content.deleteRequest")}
        description={isAdmin ? t("content.deleteText") : t("content.deleteRequestText")}
        success={isAdmin ? undefined : t("content.requested")}
        withRule
      >
        <Trash2Icon aria-hidden />
        {isAdmin ? t("content.delete") : t("content.deleteRequest")}
      </ModerationButton>
      {isAdmin && (
        <Button asChild variant="ghost" size="sm">
          <Link href={`${routes.adminDomains}?domen=${encodeURIComponent(domain)}`}>
            <BanIcon aria-hidden />
            {t("content.blockDomain")}
          </Link>
        </Button>
      )}
    </div>
  );
}
