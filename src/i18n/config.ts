/**
 * Supported UI locales. Add "ru" here (plus messages/ru.json) to enable Russian.
 * The UI locale is separate from a resource's own `language` field.
 */
export const locales = ["uz"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "uz";
