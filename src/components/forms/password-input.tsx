"use client";

import { cn } from "cn";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { type ComponentProps, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type"> & {
  showLabel: string;
  hideLabel: string;
};

/** Password field with a show/hide toggle, so people can check what they typed on a phone. */
export function PasswordInput({ className, showLabel, hideLabel, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-10", className)} {...props} />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
      </Button>
    </div>
  );
}
