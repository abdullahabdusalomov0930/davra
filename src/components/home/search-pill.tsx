import { cn } from "cn";
import { ArrowRightIcon, SearchIcon } from "lucide-react";

import { routes } from "@/lib/routes";
import { SEARCH_PARAMS, SEARCH_QUERY_MAX } from "@/lib/validators";

type SearchPillProps = {
  /** Unique per page: the field's id and the landmark's name. */
  id: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  className?: string;
};

/**
 * A large rounded search field that submits to /qidiruv. A plain GET form, so it works before the page
 * has loaded its JavaScript.
 */
export function SearchPill({ id, label, placeholder, submitLabel, className }: SearchPillProps) {
  return (
    <form
      action={routes.search}
      method="get"
      role="search"
      aria-label={label}
      className={cn(
        "group/search flex w-full max-w-xl items-center gap-1 rounded-full border border-border/80 bg-card p-1.5 pl-5",
        "shadow-[0_24px_48px_-24px_rgb(28_20_16/0.35)] transition-shadow duration-300",
        "focus-within:border-ring focus-within:shadow-[0_24px_48px_-20px_rgb(201_69_14/0.45)]",
        className,
      )}
    >
      <SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        name={SEARCH_PARAMS.query}
        placeholder={placeholder}
        autoComplete="off"
        maxLength={SEARCH_QUERY_MAX}
        className="h-11 min-w-0 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      <button
        type="submit"
        aria-label={submitLabel}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-200 outline-none group-focus-within/search:scale-105 hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowRightIcon className="size-5" aria-hidden />
      </button>
    </form>
  );
}
