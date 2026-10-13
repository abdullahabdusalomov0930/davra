import { cn } from "cn";
import Link from "next/link";

export type ListTab = { href: string; label: string; active: boolean };

/** Sort tabs above a resource list. Plain links, so each tab has its own URL. */
export function ListTabs({ label, tabs }: { label: string; tabs: readonly ListTab[] }) {
  return (
    <nav aria-label={label}>
      <ul className="inline-flex rounded-full border border-border/80 bg-card p-1 text-sm font-medium shadow-xs">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              scroll={false}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-full px-4 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                tab.active && "bg-foreground text-background hover:text-background",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
