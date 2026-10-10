import { cn } from "cn";
import Link from "next/link";

export type ListTab = { href: string; label: string; active: boolean };

/** Sort tabs above a resource list. Plain links, so each tab has its own URL. */
export function ListTabs({ label, tabs }: { label: string; tabs: readonly ListTab[] }) {
  return (
    <nav aria-label={label}>
      <ul className="inline-flex rounded-xl bg-muted p-1 text-sm font-medium">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              scroll={false}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center rounded-lg px-3 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                tab.active && "bg-background text-foreground shadow-xs",
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
