"use client";

import { usePathname, useRouter } from "next/navigation";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SEARCH_PARAMS } from "@/lib/validators";

type TopicFilterProps = {
  topics: readonly { slug: string; name_uz: string }[];
  value: string | undefined;
  label: string;
  allLabel: string;
  /** Submit label, shown only without JavaScript. */
  applyLabel: string;
};

/** A topic select that filters the current page (?mavzu=…). A GET form, so it also works without JavaScript. */
export function TopicFilter({ topics, value, label, allLabel, applyLabel }: TopicFilterProps) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <form method="get" action={pathname} className="flex items-end gap-2">
      <div className="grid gap-1.5">
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </Label>
        <NativeSelect
          id={id}
          name={SEARCH_PARAMS.topic}
          value={value ?? ""}
          className="min-w-52"
          onChange={(event) => {
            const slug = event.target.value;
            router.replace(slug ? `${pathname}?${SEARCH_PARAMS.topic}=${slug}` : pathname, { scroll: false });
          }}
        >
          <option value="">{allLabel}</option>
          {topics.map((topic) => (
            <option key={topic.slug} value={topic.slug}>
              {topic.name_uz}
            </option>
          ))}
        </NativeSelect>
      </div>
      <noscript>
        <Button type="submit" variant="outline">
          {applyLabel}
        </Button>
      </noscript>
    </form>
  );
}
