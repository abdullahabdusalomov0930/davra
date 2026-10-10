"use client";

import { CopyIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Copies a text (e.g. a reported URL that must not be opened) to the clipboard. */
export function CopyButton({ value, label, copiedLabel }: { value: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => setCopied(true));
      }}
    >
      <CopyIcon aria-hidden />
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </Button>
  );
}
