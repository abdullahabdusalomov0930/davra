import { cn } from "cn";
import Link from "next/link";

export type ListTab = { href: string; label: string; active: boolean };

/** Sort tabs above a resource list. Plain links, so each tab has its own URL. */
export function ListTabs({ label, tabs }: { label: string; tabs: readonly ListTab[] }) {
  return (
    <nav aria-label={label}>
      <ul className="inline-flex rounded-xl border-2 border-foreground bg-card p-1 text-sm font-semibold shadow-hard-sm">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              scroll={false}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-lg px-4 text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                tab.active && "bg-marker text-ink hover:bg-marker hover:text-ink",
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
