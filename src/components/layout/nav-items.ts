import { routes } from "@/lib/routes";

export const mainNavItems = [
  { href: routes.topics, labelKey: "topics" },
  { href: routes.search, labelKey: "search" },
  { href: "/haftalik", labelKey: "weekly" },
] as const;

export const legalNavItems = [
  { href: "/qoidalar", labelKey: "rules" },
  { href: "/shartlar", labelKey: "terms" },
  { href: "/maxfiylik", labelKey: "privacy" },
  { href: "/removal-request", labelKey: "removal" },
] as const;
