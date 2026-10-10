import { cn } from "cn";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/initials";

type UserAvatarProps = {
  name: string;
  src: string | null;
  className?: string;
};

/** Profile picture with initials as the fallback. Decorative: the name is always shown next to it. */
export function UserAvatar({ name, src, className }: UserAvatarProps) {
  return (
    <Avatar className={cn("select-none", className)}>
      {src && <AvatarImage src={src} alt="" loading="lazy" decoding="async" />}
      <AvatarFallback aria-hidden>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
