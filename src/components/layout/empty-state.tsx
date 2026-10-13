import { InboxIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: { href: string; label: string };
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-[1.25rem] border-2 border-dashed border-foreground/60 bg-card px-6 py-14 text-center">
      <span className="flex size-14 -rotate-6 items-center justify-center rounded-2xl border-2 border-foreground bg-accent text-accent-foreground">
        <InboxIcon className="size-6" aria-hidden />
      </span>
      <p className="mt-5 font-heading text-xl font-bold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && (
        <Button asChild className="mt-5">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
