"use client";

import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { callAction } from "@/lib/action-result";
import { recheckLinkAction } from "@/server/actions/moderation";

/** "Hozir tekshirish": runs the link checker on one link and says what it found. */
export function RecheckLinkButton({ resourceId }: { resourceId: string }) {
  const t = useTranslations("Admin.links");
  const tAction = useTranslations("ActionErrors");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function recheck() {
    setPending(true);
    const result = await callAction(() => recheckLinkAction(resourceId));
    setPending(false);
    if (!result.ok) {
      toast.error(tAction(result.error));
      return;
    }

    if (result.linkStatus === null) toast.warning(t("checkIgnored"));
    else if (result.outcome === "ok") toast.success(t("checkOk"));
    else if (result.outcome === "unknown") toast.info(t("checkUnknown"));
    else toast.warning(result.linkStatus === "broken" ? t("checkBroken") : t("checkFailure"));
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      aria-busy={pending}
      onClick={() => void recheck()}
    >
      {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <RefreshCwIcon aria-hidden />}
      {t("recheck")}
    </Button>
  );
}
