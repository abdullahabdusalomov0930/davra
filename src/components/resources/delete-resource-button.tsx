"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { callAction } from "@/lib/action-result";
import { deleteResourceAction } from "@/server/actions/resources";

type DeleteResourceButtonProps = {
  resourceId: string;
  /** Where to go once the card is gone. */
  redirectTo: string;
};

export function DeleteResourceButton({ resourceId, redirectTo }: DeleteResourceButtonProps) {
  const t = useTranslations("Resource");
  const tAction = useTranslations("ActionErrors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirmDelete() {
    setPending(true);
    const result = await callAction(() => deleteResourceAction(resourceId));
    setPending(false);

    if (!result.ok) {
      toast.error(tAction(result.error));
      return;
    }
    setOpen(false);
    toast.success(t("deleted"));
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="lg" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2Icon aria-hidden />
          {t("delete")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteText")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
          {/* A plain button, not AlertDialogAction: the dialog stays open while the request runs. */}
          <Button
            variant="destructive"
            className="bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90"
            disabled={pending}
            aria-busy={pending}
            onClick={() => void confirmDelete()}
          >
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            {t("deleteConfirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
