"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ComponentProps, type ReactNode, useState } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/forms/confirm-action";
import { Button } from "@/components/ui/button";
import { type ActionResult, callAction } from "@/lib/action-result";

type ActionButtonProps = {
  /** A Server Action bound to its arguments, e.g. `moderateResourceAction.bind(null, id, "hidden")`. */
  action: () => Promise<ActionResult<string>>;
  children: ReactNode;
  variant?: ComponentProps<typeof Button>["variant"];
  /** Ask first (destructive actions). */
  confirm?: { title: string; description: string };
  /** Toast on success; the page refreshes either way. */
  success?: string;
  className?: string;
};

/** One moderation action: confirm if needed, run, report, refresh the page. */
export function ActionButton({
  action,
  children,
  variant = "outline",
  confirm,
  success,
  className,
}: ActionButtonProps) {
  const t = useTranslations("Admin");
  const tAction = useTranslations("ActionErrors");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function execute() {
    setPending(true);
    const result = await callAction(action);
    setPending(false);
    if (!result.ok) {
      toast.error(tAction(result.error));
      return false;
    }
    toast.success(success ?? t("done"));
    router.refresh();
    return true;
  }

  if (confirm) {
    return (
      <ConfirmAction
        title={confirm.title}
        description={confirm.description}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        onConfirm={execute}
      >
        <Button type="button" variant={variant} size="sm" className={className}>
          {children}
        </Button>
      </ConfirmAction>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={() => void execute()}
    >
      {pending && <Loader2Icon className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}
