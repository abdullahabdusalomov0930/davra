import { cn } from "cn";
import { GlobeIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { faviconUrl } from "@/lib/favicon";

/** The linked site's icon, or a globe while it loads or when the site has none. Decorative. */
export function SiteFavicon({ domain, className }: { domain: string; className?: string }) {
  return (
    <Avatar className={cn("size-4 rounded-sm", className)}>
      <AvatarImage src={faviconUrl(domain)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      <AvatarFallback className="rounded-sm bg-transparent text-muted-foreground" aria-hidden>
        <GlobeIcon className="size-full" />
      </AvatarFallback>
    </Avatar>
  );
}
