import { ShieldAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ResourceForm } from "@/components/resources/resource-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { routes } from "@/lib/routes";
import { isValidSlug } from "@/lib/slugify";
import { getViewerProfile, requireViewer } from "@/server/auth/session";
import { getResourceBySlug, getTopics } from "@/server/services/resources";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ResourceForm");
  return { title: t("editTitle"), robots: { index: false } };
}

export default async function EditResourcePage({ params }: PageProps<"/resurs/[slug]/tahrirlash">) {
  const { slug } = await params;
  const viewer = await requireViewer(routes.editResource(slug));
  const resource = isValidSlug(slug) ? await getResourceBySlug(slug) : null;
  // Only the author edits a card's content; staff moderate it from the admin panel.
  if (!resource || resource.author_id !== viewer.id) notFound();

  const [t, profile, topics] = await Promise.all([getTranslations("ResourceForm"), getViewerProfile(), getTopics()]);

  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("editTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("editSubtitle")}</p>
      </header>

      {profile?.is_banned ? (
        <Alert variant="destructive">
          <ShieldAlertIcon aria-hidden />
          <AlertDescription>{t("bannedEditText")}</AlertDescription>
        </Alert>
      ) : (
        <ResourceForm
          topics={topics}
          resource={{
            id: resource.id,
            slug: resource.slug,
            status: resource.status,
            values: {
              url: resource.url,
              title: resource.title,
              topicId: resource.topic_id,
              type: resource.type,
              language: resource.language,
              price: resource.price,
              level: resource.level,
              summary: resource.summary,
              forWhom: resource.for_whom,
              authorReview: resource.author_review ?? "",
            },
          }}
        />
      )}
    </div>
  );
}
