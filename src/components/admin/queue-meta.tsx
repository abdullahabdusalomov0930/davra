import { ExternalLinkIcon, ShieldAlertIcon, ShieldCheckIcon, ShieldQuestionIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { routes } from "@/lib/routes";
import type { AuthorRecord } from "@/server/services/admin";

type Author = { username: string; display_name: string; trust_level: number };

/** Who wrote it: name, trust level and what they did so far. */
export async function AuthorInfo({ author, record }: { author: Author; record?: AuthorRecord }) {
  const t = await getTranslations("Admin.author");
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <Link href={routes.profile(author.username)} className="font-medium text-foreground hover:underline">
        {author.display_name}
      </Link>
      <Badge variant="outline">{t("trust", { level: author.trust_level })}</Badge>
      {record && (
        <span>
          {t("history", {
            published: record.published,
            hidden: record.hidden,
            rejected: record.rejected,
            confirmed: record.confirmedReports,
          })}
        </span>
      )}
    </span>
  );
}

const REPUTATION_ICONS = { safe: ShieldCheckIcon, unknown: ShieldQuestionIcon, flagged: ShieldAlertIcon } as const;

/**
 * Where a link goes: its domain (a link that opens in a new tab, unless `open` is false for severe
 * content, which moderators must not open), the final address after redirects, and the reputation.
 */
export async function LinkInfo({
  url,
  domain,
  finalUrl,
  reputation,
  open = true,
}: {
  url: string;
  domain: string;
  finalUrl?: string | null;
  reputation?: string | null;
  open?: boolean;
}) {
  const t = await getTranslations("Admin");
  const state = reputation === "safe" || reputation === "flagged" ? reputation : "unknown";
  const Icon = REPUTATION_ICONS[state];
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      {open ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          {domain}
          <ExternalLinkIcon className="size-3" aria-hidden />
          <span className="sr-only">{t("openLink")}</span>
        </a>
      ) : (
        <span className="font-medium">{domain}</span>
      )}
      <span
        className={
          state === "flagged" ? "inline-flex items-center gap-1 text-destructive" : "inline-flex items-center gap-1"
        }
      >
        <Icon className="size-3.5" aria-hidden />
        {t(`reputation.${state}`)}
      </span>
      {finalUrl && finalUrl !== url && <span className="min-w-0 break-all">{t("finalUrl", { url: finalUrl })}</span>}
    </span>
  );
}
