import { PartyPopperIcon, ShieldAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { DeleteAccountButton, ExportDataButton } from "@/components/settings/account-data";
import { ProfileForm } from "@/components/settings/profile-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { firstParam } from "@/lib/auth-links";
import { routes } from "@/lib/routes";
import { signOutAction } from "@/server/actions/auth";
import { getViewerProfile, requireViewer } from "@/server/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings");
  return { title: t("title"), robots: { index: false } };
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border bg-card p-5 text-card-foreground sm:p-6">
      <h2 id={id} className="mb-5 text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function SettingsPage({ searchParams }: PageProps<"/sozlamalar">) {
  await requireViewer(routes.settings);
  const profile = await getViewerProfile();
  if (!profile) redirect(routes.signIn);

  const [t, tProfile] = await Promise.all([getTranslations("Settings"), getTranslations("Profile")]);
  const welcome = firstParam((await searchParams)["xush-kelibsiz"]) !== undefined;

  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={routes.profile(profile.username)}>{t("viewProfile")}</Link>
        </Button>
      </header>

      {welcome && (
        <Alert variant="success" role="status">
          <PartyPopperIcon aria-hidden />
          <AlertTitle>{t("welcomeTitle")}</AlertTitle>
          <AlertDescription>{t("welcomeText")}</AlertDescription>
        </Alert>
      )}
      {profile.is_banned && (
        <Alert variant="destructive">
          <ShieldAlertIcon aria-hidden />
          <AlertTitle>{tProfile("banned")}</AlertTitle>
        </Alert>
      )}

      <Section id="profile-title" title={t("profileTitle")}>
        <ProfileForm
          defaultValues={{
            displayName: profile.display_name,
            username: profile.username,
            bio: profile.bio ?? "",
            university: profile.university ?? "",
            fieldOfStudy: profile.field_of_study ?? "",
          }}
        />
      </Section>

      <Section id="account-title" title={t("accountTitle")}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <dl className="min-w-0 text-sm">
            <dt className="text-muted-foreground">{t("accountEmail")}</dt>
            <dd className="mt-0.5 truncate font-medium">{profile.email}</dd>
          </dl>
          <form action={signOutAction}>
            <Button type="submit" variant="outline">
              {t("signOut")}
            </Button>
          </form>
        </div>
      </Section>

      <Section id="data-title" title={t("dataTitle")}>
        <div className="grid gap-6">
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">{t("exportText")}</p>
            <div>
              <ExportDataButton />
            </div>
          </div>
          <div className="grid gap-3 border-t pt-6">
            <h3 className="font-medium">{t("deleteTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("deleteText")}</p>
            <div>
              <DeleteAccountButton username={profile.username} />
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
