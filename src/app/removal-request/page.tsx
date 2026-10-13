import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { RemovalRequestForm } from "@/components/reports/removal-request-form";
import { firstParam } from "@/lib/auth-links";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("RemovalRequest");
  return { title: t("title"), description: t("metaDescription"), alternates: { canonical: routes.removalRequest } };
}

/** Public form for copyright holders and others; no account needed (D53). */
export default async function RemovalRequestPage({ searchParams }: PageProps<"/removal-request">) {
  const t = await getTranslations("RemovalRequest");
  const url = firstParam((await searchParams).url);

  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("intro")}</p>
      </header>
      <section className="rounded-2xl border-2 border-foreground bg-card p-5 text-card-foreground shadow-hard sm:p-6">
        <RemovalRequestForm defaultUrl={url && url.length <= 2048 ? url : undefined} />
      </section>
    </div>
  );
}
