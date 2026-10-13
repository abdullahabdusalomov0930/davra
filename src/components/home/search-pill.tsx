import { cn } from "cn";
import { SearchIcon } from "lucide-react";

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
 * A large search field cut out of white paper, with an ink outline and a hard shadow; it submits to
 * /qidiruv. A plain GET form, so it works before the page has loaded its JavaScript.
 */
export function SearchPill({ id, label, placeholder, submitLabel, className }: SearchPillProps) {
  return (
    <form
      action={routes.search}
      method="get"
      role="search"
      aria-label={label}
      className={cn(
        "flex w-full max-w-xl items-center gap-1.5 rounded-2xl border-[2.5px] border-foreground bg-card p-2 pl-4 text-card-foreground shadow-hard-lg",
        "transition-shadow duration-200 focus-within:ring-3 focus-within:ring-ring/50",
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
        className="h-11 min-w-0 flex-1 bg-transparent px-1.5 text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      <button
        type="submit"
        className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-ink px-3.5 font-semibold text-marker transition-transform duration-150 outline-none hover:-rotate-2 focus-visible:ring-3 focus-visible:ring-ring/60 sm:px-5"
      >
        <SearchIcon className="size-4.5 sm:hidden" aria-hidden />
        <span className="sr-only sm:not-sr-only">{submitLabel}</span>
      </button>
    </form>
  );
}
