import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import { useId } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

export type ChoiceOption = { value: string; label: string; icon?: LucideIcon };

type ChoiceChipsProps = {
  legend: string;
  options: readonly ChoiceOption[];
  /** `form.register(name)`; every radio shares it. */
  registration: UseFormRegisterReturn;
  error?: string;
};

/**
 * A radio group drawn as chips. Native radios keep keyboard behavior (Tab into the group, arrow
 * keys between options) and work without JavaScript.
 */
export function ChoiceChips({ legend, options, registration, error }: ChoiceChipsProps) {
  const errorId = useId();

  return (
    <fieldset className="grid gap-2" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-2 text-sm leading-none font-medium select-none">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors select-none hover:bg-muted hover:text-foreground dark:bg-input/30",
              "has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground",
              "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              error && "border-destructive/60",
            )}
          >
            <input type="radio" value={value} className="sr-only" {...registration} />
            {Icon && <Icon className="size-4" aria-hidden />}
            {label}
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
