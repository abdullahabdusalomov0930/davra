import { Loader2Icon } from "lucide-react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, "type"> & { pending: boolean };

export function SubmitButton({ pending, disabled, children, ...props }: SubmitButtonProps) {
  return (
    <Button type="submit" size="lg" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending && <Loader2Icon className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}
