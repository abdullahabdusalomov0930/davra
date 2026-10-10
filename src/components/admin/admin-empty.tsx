import { InboxIcon } from "lucide-react";

export function AdminEmpty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
      <InboxIcon className="size-6" aria-hidden />
      {text}
    </div>
  );
}
