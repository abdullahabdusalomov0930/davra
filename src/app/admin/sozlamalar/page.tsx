import { Trash2Icon } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ActionButton } from "@/components/admin/action-button";
import { SettingsForm } from "@/components/admin/settings-form";
import { TermForm } from "@/components/admin/term-form";
import { Badge } from "@/components/ui/badge";
import { removeTermAction } from "@/server/actions/moderation";
import { getStaffProfile } from "@/server/auth/session";
import { listBlockedTerms } from "@/server/services/admin";
import { getSettings } from "@/server/services/settings";

export async function generateMetadata() {
  const t = await getTranslations("Admin");
  return { title: t("nav.settings") };
}

/** Admins: auto-hide thresholds, the "leaving Davracha" page, extra words for the word filter. */
export default async function AdminSettingsPage() {
  const staff = await getStaffProfile();
  if (staff?.role !== "admin") notFound();
  const [t, settings, terms] = await Promise.all([getTranslations("Admin"), getSettings(), listBlockedTerms()]);

  return (
    <div className="grid gap-8">
      <section
        aria-labelledby="settings-title"
        className="grid gap-4 rounded-2xl border-2 border-foreground bg-card p-5 shadow-hard-sm"
      >
        <h2 id="settings-title" className="text-lg font-semibold">
          {t("settings.title")}
        </h2>
        <SettingsForm values={settings} />
      </section>

      <section
        aria-labelledby="terms-title"
        className="grid gap-4 rounded-2xl border-2 border-foreground bg-card p-5 shadow-hard-sm"
      >
        <div className="grid gap-1">
          <h2 id="terms-title" className="text-lg font-semibold">
            {t("settings.termsTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("settings.termsHint")}</p>
        </div>
        <TermForm />
        {terms.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("settings.termsEmpty")}</p>
        ) : (
          <ul className="divide-y text-sm">
            {terms.map((term) => (
              <li key={term.term} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-2">
                  <code>{term.term}</code>
                  <Badge variant="outline">{t(`settings.categories.${term.category as "scam"}`)}</Badge>
                </span>
                <ActionButton action={removeTermAction.bind(null, term.term)} variant="ghost">
                  <Trash2Icon aria-hidden />
                  {t("settings.remove")}
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
