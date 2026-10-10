import { ClockIcon, EyeOffIcon, LinkIcon, OctagonXIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { routes } from "@/lib/routes";
import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

/**
 * Tells the author (or staff) why a card is not public, and warns everyone about a broken link.
 * Renders nothing for a published card with a working link.
 */
export function ResourceStatusAlert({
  status,
  linkStatus,
}: {
  status: Enums["resource_status"];
  linkStatus: Enums["link_status"];
}) {
  const t = useTranslations("Resource");

  if (status === "pending") {
    return (
      <Alert role="status">
        <ClockIcon aria-hidden />
        <AlertTitle>{t("pendingTitle")}</AlertTitle>
        <AlertDescription>{t("pendingText")}</AlertDescription>
      </Alert>
    );
  }
  if (status === "hidden" || status === "rejected") {
    const Icon = status === "hidden" ? EyeOffIcon : OctagonXIcon;
    return (
      <Alert variant="destructive">
        <Icon aria-hidden />
        <AlertTitle>{status === "hidden" ? t("hiddenTitle") : t("rejectedTitle")}</AlertTitle>
        <AlertDescription>
          <p>{status === "hidden" ? t("hiddenText") : t("rejectedText")}</p>
          <Link href={routes.rules} className="font-medium underline underline-offset-4">
            {t("rulesLink")}
          </Link>
        </AlertDescription>
      </Alert>
    );
  }
  if (linkStatus === "broken") {
    return (
      <Alert variant="destructive">
        <LinkIcon aria-hidden />
        <AlertTitle>{t("brokenTitle")}</AlertTitle>
        <AlertDescription>{t("brokenText")}</AlertDescription>
      </Alert>
    );
  }
  return null;
}
