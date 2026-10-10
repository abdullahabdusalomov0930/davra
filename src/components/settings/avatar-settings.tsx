"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ChangeEvent, useRef, useTransition } from "react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/profile/user-avatar";
import { Button } from "@/components/ui/button";
import { callAction } from "@/lib/action-result";
import { AVATAR_TYPES } from "@/lib/images";
import { resizeToSquare } from "@/lib/resize-image";
import { removeAvatarAction, uploadAvatarAction } from "@/server/actions/profile";

type AvatarSettingsProps = { name: string; avatarUrl: string | null };

export function AvatarSettings({ name, avatarUrl }: AvatarSettingsProps) {
  const t = useTranslations("Settings");
  const tAction = useTranslations("ActionErrors");
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(tAction("avatarType"));
      return;
    }

    startTransition(async () => {
      let image: Blob;
      try {
        image = await resizeToSquare(file);
      } catch {
        toast.error(t("avatarUnreadable"));
        return;
      }

      const formData = new FormData();
      formData.set("avatar", image, "avatar");
      const result = await callAction(() => uploadAvatarAction(formData));
      if (result.ok) toast.success(t("avatarUpdated"));
      else toast.error(tAction(result.error));
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await callAction(removeAvatarAction);
      if (result.ok) toast.success(t("avatarRemoved"));
      else toast.error(tAction(result.error));
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <UserAvatar name={name} src={avatarUrl} className="size-20 text-2xl" />
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}>
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            {avatarUrl ? t("avatarChange") : t("avatarUpload")}
          </Button>
          {avatarUrl && (
            <Button type="button" variant="ghost" disabled={pending} onClick={remove}>
              {t("avatarRemove")}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("avatarHint")}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onFileChange}
      />
    </div>
  );
}
