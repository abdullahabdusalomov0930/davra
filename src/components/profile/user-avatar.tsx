import { cn } from "cn";

import { initials } from "@/lib/initials";

// Profiles have no photos (security addendum: no uploads at all). Each person gets their initials on a
// colour picked from their username, so the same person always looks the same. All shades keep white
// text above WCAG AA contrast.
const COLORS = [
  "bg-teal-700",
  "bg-sky-700",
  "bg-indigo-700",
  "bg-violet-700",
  "bg-fuchsia-700",
  "bg-rose-700",
  "bg-orange-700",
  "bg-emerald-700",
] as const;

function colorFor(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return COLORS[hash % COLORS.length];
}

type UserAvatarProps = {
  name: string;
  /** Stable per person (the username); the colour is derived from it. */
  seed: string;
  className?: string;
};

/** Initials on a colour of their own. Decorative: the name is always shown next to it. */
export function UserAvatar({ name, seed, className }: UserAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full font-medium text-white select-none",
        colorFor(seed),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
