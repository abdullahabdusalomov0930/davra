"use client";

import { SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ChangeEvent, type ComponentProps, type FormEvent, type ReactNode, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { routes } from "@/lib/routes";
import {
  defaultSearchSort,
  type FeedSort,
  RESOURCE_LANGUAGES,
  RESOURCE_LEVELS,
  RESOURCE_PRICES,
  RESOURCE_TYPES,
  SEARCH_PARAMS,
  SEARCH_QUERY_MAX,
  SORT_PARAM_VALUES,
  sortFromParam,
  toSearchQueryString,
} from "@/lib/validators";

type FilterValues = {
  text?: string;
  topic?: string;
  type?: string;
  language?: string;
  price?: string;
  level?: string;
  sort: FeedSort;
};

type SearchFiltersProps = {
  topics: readonly { slug: string; name_uz: string }[];
  /** The values in the current URL. */
  values: FilterValues;
  hasFilters: boolean;
};

function FilterSelect({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & ComponentProps<"select">) {
  const id = useId();
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <NativeSelect id={id} {...props}>
        {children}
      </NativeSelect>
    </div>
  );
}

/**
 * Search box and filters. A plain GET form (works without JavaScript); with JavaScript a changed
 * filter applies at once and empty values stay out of the URL. The URL is the source of truth: the
 * fields follow it when it changes (back button, "clear filters").
 */
export function SearchFilters({ topics, values, hasFilters }: SearchFiltersProps) {
  const t = useTranslations("Search");
  const tType = useTranslations("ResourceType");
  const tLanguage = useTranslations("ResourceLanguage");
  const tPrice = useTranslations("ResourcePrice");
  const tLevel = useTranslations("ResourceLevel");
  const router = useRouter();

  const [fields, setFields] = useState(values);
  const valuesKey = JSON.stringify(values);
  const [syncedKey, setSyncedKey] = useState(valuesKey);
  if (valuesKey !== syncedKey) {
    setSyncedKey(valuesKey);
    setFields(values);
  }

  function navigate(next: FilterValues, mode: "push" | "replace") {
    router[mode](`${routes.search}${toSearchQueryString({ ...next, text: next.text?.trim() })}`, { scroll: false });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = fields.text?.trim() || undefined;
    // A new query starts with the best matches; the sort can be changed again afterwards.
    navigate(text === values.text ? fields : { ...fields, text, sort: defaultSearchSort(text) }, "push");
  }

  function select(name: Exclude<keyof FilterValues, "text" | "sort">) {
    return {
      name: SEARCH_PARAMS[name],
      value: fields[name] ?? "",
      onChange: (event: ChangeEvent<HTMLSelectElement>) => {
        const next = { ...fields, [name]: event.target.value || undefined };
        setFields(next);
        navigate(next, "replace");
      },
    };
  }

  return (
    <form action={routes.search} method="get" role="search" onSubmit={onSubmit} className="grid gap-4">
      <div className="flex gap-2">
        <Input
          type="search"
          name={SEARCH_PARAMS.query}
          value={fields.text ?? ""}
          onChange={(event) => setFields({ ...fields, text: event.target.value })}
          maxLength={SEARCH_QUERY_MAX}
          placeholder={t("placeholder")}
          aria-label={t("queryLabel")}
          enterKeyHint="search"
          className="h-10"
        />
        <Button type="submit" size="lg" className="h-10">
          <SearchIcon aria-hidden />
          <span className="sr-only sm:not-sr-only">{t("submit")}</span>
        </Button>
      </div>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <legend className="sr-only">{t("filtersLabel")}</legend>
        <FilterSelect label={t("topic")} {...select("topic")}>
          <option value="">{t("anyTopic")}</option>
          {topics.map((topic) => (
            <option key={topic.slug} value={topic.slug}>
              {topic.name_uz}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label={t("type")} {...select("type")}>
          <option value="">{t("anyType")}</option>
          {RESOURCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {tType(type)}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label={t("language")} {...select("language")}>
          <option value="">{t("anyLanguage")}</option>
          {RESOURCE_LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {tLanguage(language)}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label={t("price")} {...select("price")}>
          <option value="">{t("anyPrice")}</option>
          {RESOURCE_PRICES.map((price) => (
            <option key={price} value={price}>
              {tPrice(price)}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label={t("level")} {...select("level")}>
          <option value="">{t("anyLevel")}</option>
          {RESOURCE_LEVELS.map((level) => (
            <option key={level} value={level}>
              {tLevel(level)}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label={t("sort")}
          name={SEARCH_PARAMS.sort}
          value={SORT_PARAM_VALUES[fields.sort]}
          onChange={(event) => {
            const next = { ...fields, sort: sortFromParam(event.target.value) ?? fields.sort };
            setFields(next);
            navigate(next, "replace");
          }}
        >
          {values.text && <option value={SORT_PARAM_VALUES.relevance}>{t("sortRelevance")}</option>}
          <option value={SORT_PARAM_VALUES.newest}>{t("sortNewest")}</option>
          <option value={SORT_PARAM_VALUES.top}>{t("sortTop")}</option>
        </FilterSelect>
      </fieldset>

      {hasFilters && (
        <Button asChild variant="ghost" size="sm" className="w-fit text-muted-foreground">
          <Link href={routes.search} scroll={false}>
            <XIcon aria-hidden />
            {t("clear")}
          </Link>
        </Button>
      )}
    </form>
  );
}
