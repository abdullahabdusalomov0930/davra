import { FileWarningIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { legalNavItems } from "@/components/layout/nav-items";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { uzDateParts } from "@/lib/dates";
import { getPublicEnv } from "@/lib/env";
import { APP_NAME } from "@/lib/config";

export type LegalDocument = "rules" | "terms" | "privacy";

/** `id`: an anchor other pages link to, e.g. /qoidalar#spam from a notification. */
type Section = { id?: string; title: string; paragraphs?: string[]; items?: string[] };

/** The text lives in messages/uz.json (Legal.*) as plain strings; `{appName}` is the only placeholder. */
function fill(text: string) {
  return text.replaceAll("{appName}", APP_NAME);
}

export async function legalMetadata(document: LegalDocument, path: string) {
  const t = await getTranslations("Legal");
  return {
    title: t(`${document}.title`),
    description: fill(t.raw(`${document}.metaDescription`) as string),
    alternates: { canonical: path },
  };
}

/**
 * A legal page (rules, terms, privacy): clearly marked as a draft until a lawyer has reviewed it
 * (brief 6.8), with the date of the last change and links to the other legal pages.
 */
export async function LegalPage({
  document,
  path,
  updatedAt,
  showContact = false,
}: {
  document: LegalDocument;
  path: string;
  /** ISO date of the last change to this text. */
  updatedAt: string;
  showContact?: boolean;
}) {
  const [t, tFooter, format] = await Promise.all([getTranslations("Legal"), getTranslations("Footer"), getFormatter()]);
  const sections = t.raw(`${document}.sections`) as Section[];
  const contactEmail = getPublicEnv().NEXT_PUBLIC_CONTACT_EMAIL;

  return (
    <article className="mx-auto grid max-w-3xl gap-8 px-4 py-10">
      <Alert>
        <FileWarningIcon aria-hidden />
        <AlertTitle>{t("draftTitle")}</AlertTitle>
        <AlertDescription>{t("draftText")}</AlertDescription>
      </Alert>

      <header className="grid gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{t(`${document}.title`)}</h1>
        <p className="text-sm text-muted-foreground">
          <time dateTime={updatedAt}>{t("updated", uzDateParts(format, updatedAt))}</time>
        </p>
        <p className="text-lg text-pretty text-muted-foreground">{fill(t.raw(`${document}.intro`) as string)}</p>
      </header>

      {sections.map((section) => (
        <section key={section.title} id={section.id} className="grid scroll-mt-20 gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{fill(section.title)}</h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph} className="leading-relaxed text-pretty">
              {fill(paragraph)}
            </p>
          ))}
          {section.items && (
            <ul className="grid list-disc gap-2 pl-5 leading-relaxed marker:text-muted-foreground">
              {section.items.map((item) => (
                <li key={item} className="text-pretty">
                  {fill(item)}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {showContact && (
        <section className="grid gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{t("contactTitle")}</h2>
          <p className="leading-relaxed text-pretty">
            {contactEmail
              ? t.rich("contactText", {
                  email: () => (
                    <a href={`mailto:${contactEmail}`} className="font-medium underline underline-offset-4">
                      {contactEmail}
                    </a>
                  ),
                })
              : t("contactPending")}
          </p>
        </section>
      )}

      <nav aria-labelledby="legal-related" className="grid gap-3 border-t pt-6">
        <h2 id="legal-related" className="text-sm font-semibold text-muted-foreground">
          {t("relatedTitle")}
        </h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {legalNavItems
            .filter((item) => item.href !== path)
            .map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="underline underline-offset-4 hover:text-foreground">
                  {tFooter(item.labelKey)}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </article>
  );
}
