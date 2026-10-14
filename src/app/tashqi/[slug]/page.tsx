import { ArrowLeftIcon, ExternalLinkIcon, ShieldAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/config";
import { OUTBOUND_REL } from "@/lib/outbound";
import { routes } from "@/lib/routes";
import { getResourceBySlug } from "@/server/services/resources";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Outbound");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/**
 * "Siz tashqi saytga oʻtyapsiz": shown before links to sites Davracha does not know yet (D73). Shows the
 * real domain and the full address; nothing from the site is fetched or embedded.
 */
export default async function OutboundPage({ params }: PageProps<"/tashqi/[slug]">) {
  const { slug } = await params;
  const resource = await getResourceBySlug(slug);
  if (!resource) notFound();
  const t = await getTranslations("Outbound");

  return (
    <div className="mx-auto grid max-w-xl gap-6 px-4 py-16">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
        <ShieldAlertIcon className="size-6" aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-pretty text-muted-foreground">{t("text", { appName: APP_NAME })}</p>
      <dl className="grid gap-3 rounded-2xl border-2 border-foreground bg-card p-5 text-sm shadow-hard">
        <div className="grid gap-1">
          <dt className="text-muted-foreground">{t("site")}</dt>
          <dd className="text-lg font-semibold">{resource.domain}</dd>
        </div>
        <div className="grid gap-1">
          <dt className="text-muted-foreground">{t("address")}</dt>
          <dd className="break-all">{resource.url}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="lg">
          <a href={resource.url} target="_blank" rel={OUTBOUND_REL}>
            {t("continue")}
            <ExternalLinkIcon aria-hidden />
          </a>
        </Button>
        <Button asChild size="lg" variant="ghost">
          <Link href={routes.resource(resource.slug)}>
            <ArrowLeftIcon aria-hidden />
            {t("back")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
