import { InfoIcon, ShieldAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ResourceForm } from "@/components/resources/resource-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { routes } from "@/lib/routes";
import { getViewerProfile, requireViewer } from "@/server/auth/session";
import { getTopics } from "@/server/services/topics";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ResourceForm");
  return { title: t("newTitle"), robots: { index: false } };
}

export default async function NewResourcePage() {
  await requireViewer(routes.newResource);
  const [t, profile, topics] = await Promise.all([getTranslations("ResourceForm"), getViewerProfile(), getTopics()]);
  if (!profile) redirect(routes.signIn);

  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("newTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("newSubtitle")}</p>
      </header>

      {profile.is_banned ? (
        <Alert variant="destructive">
          <ShieldAlertIcon aria-hidden />
          <AlertDescription>{t("bannedText")}</AlertDescription>
        </Alert>
      ) : (
        <>
          {profile.role === "user" && (
            <Alert>
              <InfoIcon aria-hidden />
              <AlertDescription>{t("reviewNotice")}</AlertDescription>
            </Alert>
          )}
          <ResourceForm topics={topics} />
        </>
      )}
    </div>
  );
}
