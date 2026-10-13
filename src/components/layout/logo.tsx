import { cn } from "cn";

import { APP_NAME } from "@/lib/config";
import { LOGO_MARK_PATH } from "@/lib/brand";

/** The ring mark alone, in the bright brand orange. Decorative: the link around it carries the name. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-7 shrink-0 text-brand", className)}>
      <path d={LOGO_MARK_PATH} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

/** Mark and wordmark: the app name, lower case, in the heading serif. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark className="transition-transform duration-500 group-hover/logo:rotate-[200deg]" />
      <span className="font-heading text-[1.6rem] leading-none font-medium tracking-[-0.03em]">
        {APP_NAME.toLowerCase()}
      </span>
    </span>
  );
}
