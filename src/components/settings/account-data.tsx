"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { DownloadIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Field } from "@/components/forms/field";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { useErrorMessage } from "@/components/forms/use-error-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { callAction } from "@/lib/action-result";
import { type DeleteAccountInput, deleteAccountSchema } from "@/lib/validators";
import { deleteAccountAction, exportDataAction } from "@/server/actions/account";

/** "Maʼlumotlarimni yuklab olish": the user's data as a JSON file. */
export function ExportDataButton() {
  const t = useTranslations("Settings");
  const tAction = useTranslations("ActionErrors");
  const [pending, setPending] = useState(false);

  async function download() {
    setPending(true);
    const result = await callAction(() => exportDataAction());
    setPending(false);
    if (!result.ok) {
      toast.error(tAction(result.error));
      return;
    }
    const url = URL.createObjectURL(new Blob([result.json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `davra-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t("exportDone"));
  }

  return (
    <Button type="button" variant="outline" disabled={pending} aria-busy={pending} onClick={() => void download()}>
      <DownloadIcon aria-hidden />
      {t("exportButton")}
    </Button>
  );
}

/** Deletes the account after the username and password are typed again. */
export function DeleteAccountButton({ username }: { username: string }) {
  const t = useTranslations("Settings");
  const tAction = useTranslations("ActionErrors");
  const tAuth = useTranslations("Auth");
  const tForm = useTranslations("Form");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<DeleteAccountInput>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { username: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async () => {
    const result = await callAction(() => deleteAccountAction(form.getValues()));
    if (!result.ok) {
      for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof DeleteAccountInput, { message: key });
      }
      if (!result.fieldErrors) toast.error(tAction(result.error));
      return;
    }
    toast.success(t("deleted"));
    router.replace("/");
    router.refresh();
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive">
          <Trash2Icon aria-hidden />
          {t("deleteButton")}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tForm("close")}>
        <DialogHeader>
          <DialogTitle>{t("deleteDialogTitle")}</DialogTitle>
          <DialogDescription>{t("deleteText")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <Field label={t("deleteUsernameLabel", { username })} error={errorMessage(errors.username)}>
            {(control) => (
              <Input
                {...control}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                {...form.register("username")}
              />
            )}
          </Field>
          <Field label={t("deletePasswordLabel")} error={errorMessage(errors.password)}>
            {(control) => (
              <PasswordInput
                {...control}
                autoComplete="current-password"
                showLabel={tAuth("showPassword")}
                hideLabel={tAuth("hidePassword")}
                {...form.register("password")}
              />
            )}
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)} disabled={isSubmitting}>
              {t("deleteCancel")}
            </Button>
            <SubmitButton pending={isSubmitting} variant="destructive">
              {t("deleteSubmit")}
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
