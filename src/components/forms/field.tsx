"use client";

import { type ReactNode, useId } from "react";

import { Label } from "@/components/ui/label";

export type FieldControlProps = {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
};

type FieldProps = {
  label: string;
  /** Already translated error message. */
  error?: string;
  hint?: ReactNode;
  /** Shown after the label, e.g. "(ixtiyoriy)". */
  optionalLabel?: string;
  /** Rendered at the end of the label row, e.g. a "forgot password" link. */
  labelAction?: ReactNode;
  /** Receives the id and ARIA attributes that tie the control to its label, hint and error. */
  children: (control: FieldControlProps) => ReactNode;
};

export function Field({ label, error, hint, optionalLabel, labelAction, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid gap-2">
      <div className="flex min-h-4 items-center justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          {optionalLabel && <span className="font-normal text-muted-foreground">({optionalLabel})</span>}
        </Label>
        {labelAction}
      </div>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint && (
        <div id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </div>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
