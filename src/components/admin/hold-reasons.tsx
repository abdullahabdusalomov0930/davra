import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";

const FIELDS = ["title", "summary", "forWhom", "authorReview", "body", "url"] as const;
// Reason codes that can put something in the queue, and their message keys.
const REASONS = {
  "trust.new": "trust_new",
  "trust.new_link": "trust_new_link",
  "text.profanity": "text_profanity",
  "text.hate": "text_hate",
  "text.sexual": "text_sexual",
  "text.drugs_weapons": "text_drugs_weapons",
  "text.scam": "text_scam",
  "text.gambling": "text_gambling",
  "text.contact": "text_contact",
  "url.category": "url_category",
  "url.redirect_chain": "url_redirect_chain",
} as const;

/**
 * Why the safety check sent something to the queue. Codes look like "text.gambling:summary",
 * "url.category:file_hosting" or "final.url.category:…" (where the link really leads).
 */
export async function HoldReasons({ reasons }: { reasons: readonly string[] | undefined }) {
  if (!reasons?.length) return null;
  const t = await getTranslations("Admin.holdReasons");

  const label = (code: string) => {
    const final = code.startsWith("final.");
    const [reason, detail] = (final ? code.slice("final.".length) : code).split(":");
    const key = Object.hasOwn(REASONS, reason) ? REASONS[reason as keyof typeof REASONS] : null;
    const field = FIELDS.find((value) => value === detail);
    const parts = [key ? t(`reasons.${key}`) : reason];
    if (field) parts.push(t(`fields.${field}`));
    else if (detail) parts.push(detail);
    if (final) parts.push(t("finalUrl"));
    return parts.join(" · ");
  };

  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span>{t("title")}</span>
      {[...new Set(reasons)].map((code) => (
        <Badge key={code} variant="outline">
          {label(code)}
        </Badge>
      ))}
    </p>
  );
}
