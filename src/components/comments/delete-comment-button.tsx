"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/forms/confirm-action";
import { Button } from "@/components/ui/button";
import { callAction } from "@/lib/action-result";
import { deleteCommentAction } from "@/server/actions/interactions";

export function DeleteCommentButton({ commentId }: { commentId: string }) {
  const t = useTranslations("Comments");
  const tAction = useTranslations("ActionErrors");
  const router = useRouter();

  async function onConfirm() {
    const result = await callAction(() => deleteCommentAction(commentId));
    if (!result.ok) {
      toast.error(tAction(result.error));
      return false;
    }
    toast.success(t("deleted"));
    router.refresh();
    return true;
  }

  return (
    <ConfirmAction
      title={t("deleteTitle")}
      description={t("deleteText")}
      confirmLabel={t("deleteConfirm")}
      cancelLabel={t("cancel")}
      onConfirm={onConfirm}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-destructive"
        aria-label={t("deleteLabel")}
      >
        <Trash2Icon aria-hidden />
      </Button>
    </ConfirmAction>
  );
}
