import { routes } from "@/lib/routes";

export const mainNavItems = [
  { href: routes.topics, labelKey: "topics" },
  { href: routes.search, labelKey: "search" },
  { href: routes.weekly, labelKey: "weekly" },
] as const;

export const legalNavItems = [
  { href: routes.rules, labelKey: "rules" },
  { href: routes.terms, labelKey: "terms" },
  { href: routes.privacy, labelKey: "privacy" },
  { href: routes.removalRequest, labelKey: "removal" },
] as const;
