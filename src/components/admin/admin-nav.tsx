"use client";

import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminNavProps = {
  label: string;
  items: readonly { href: string; label: string; count?: number }[];
};

/** Section tabs of the moderation panel; scrolls sideways on small screens. */
export function AdminNav({ label, items }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4">
      <ul className="flex w-max gap-1 rounded-xl bg-muted p-1 text-sm font-medium">
        {items.map((item) => {
          const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                  active && "bg-background text-foreground shadow-xs",
                )}
              >
                {item.label}
                {item.count ? (
                  <span className="rounded-full bg-primary px-1.5 text-xs leading-5 text-primary-foreground tabular-nums">
                    {item.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
