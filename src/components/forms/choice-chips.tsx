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
              "inline-flex cursor-pointer items-center gap-1.5 rounded-[0.625rem] border-2 border-dashed border-foreground/45 bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition select-none hover:border-foreground hover:text-foreground",
              "has-checked:border-solid has-checked:border-foreground has-checked:bg-marker has-checked:text-ink has-checked:shadow-hard-sm",
              "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              error && "border-destructive",
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
