"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/ui/native-select";
import { callAction } from "@/lib/action-result";
import { setUserRoleAction } from "@/server/actions/moderation";
import { Constants, type Database } from "@/types/database";

type Role = Database["public"]["Enums"]["user_role"];

/** Admins change roles here; the database refuses anyone else (and changing your own role). */
export function RoleSelect({ userId, role, label }: { userId: string; role: Role; label: string }) {
  const tRole = useTranslations("UserRole");
  const tAdmin = useTranslations("Admin");
  const tAction = useTranslations("ActionErrors");
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(role);
  const [pending, setPending] = useState(false);

  async function change(next: Role) {
    const previous = value;
    setValue(next);
    setPending(true);
    const result = await callAction(() => setUserRoleAction(userId, next));
    setPending(false);
    if (!result.ok) {
      setValue(previous);
      toast.error(tAction(result.error));
      return;
    }
    toast.success(tAdmin("done"));
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <NativeSelect
        id={id}
        value={value}
        disabled={pending}
        className="h-8 min-w-36"
        onChange={(event) => void change(event.target.value as Role)}
      >
        {Constants.public.Enums.user_role.map((option) => (
          <option key={option} value={option}>
            {tRole(option)}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
