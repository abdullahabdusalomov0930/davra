import { InfoIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ActionButton } from "@/components/admin/action-button";
import { TopicForm } from "@/components/admin/topic-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { routes } from "@/lib/routes";
import { deleteTopicAction } from "@/server/actions/moderation";
import { getViewerProfile } from "@/server/auth/session";
import { listTopicsForAdmin } from "@/server/services/admin";

export async function generateMetadata() {
  const t = await getTranslations("Admin");
  return { title: t("nav.topics") };
}

export default async function AdminTopicsPage() {
  const [t, viewer, topics] = await Promise.all([getTranslations("Admin"), getViewerProfile(), listTopicsForAdmin()]);
  const isAdmin = viewer?.role === "admin";

  return (
    <div className="grid gap-6">
      {isAdmin ? (
        <section aria-labelledby="new-topic-title" className="grid gap-4 rounded-2xl border bg-card p-5">
          <h2 id="new-topic-title" className="font-semibold">
            {t("topics.newTopic")}
          </h2>
          <TopicForm />
        </section>
      ) : (
        <Alert>
          <InfoIcon aria-hidden />
          <AlertDescription>{t("adminOnly")}</AlertDescription>
        </Alert>
      )}

      <ul className="grid gap-4">
        {topics.map((topic) => (
          <li key={topic.id} className="grid gap-4 rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link href={routes.topic(topic.slug)} className="font-semibold hover:underline">
                {topic.name_uz}
              </Link>
              <span className="text-xs text-muted-foreground">
                {t("topics.resourceCount", { count: topic.resourceCount })}
              </span>
            </div>
            {isAdmin && (
              <>
                <TopicForm
                  topicId={topic.id}
                  defaultValues={{
                    slug: topic.slug,
                    nameUz: topic.name_uz,
                    descriptionUz: topic.description_uz ?? "",
                    sortOrder: topic.sort_order,
                  }}
                />
                {topic.resourceCount === 0 && (
                  <div className="flex justify-end">
                    <ActionButton
                      action={deleteTopicAction.bind(null, topic.id)}
                      variant="destructive"
                      success={t("topics.deleted")}
                      confirm={{ title: t("topics.deleteTitle"), description: t("topics.deleteText") }}
                    >
                      <Trash2Icon aria-hidden />
                      {t("topics.delete")}
                    </ActionButton>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
