import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";
import { firstParam } from "@/lib/auth-links";
import { routes } from "@/lib/routes";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { siteConfig } from "@/lib/site-config";
import { getViewer } from "@/server/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("signInTitle"), robots: { index: false } };
}

export default async function SignInPage({ searchParams }: PageProps<"/kirish">) {
  const next = safeRedirectPath(firstParam((await searchParams).next));
  if (await getViewer()) redirect(next);

  const t = await getTranslations("Auth");

  return (
    <AuthCard
      title={t("signInTitle")}
      description={t("signInSubtitle", { appName: siteConfig.name })}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link href={routes.signUp} className="font-medium text-primary hover:underline">
            {t("signUpLink")}
          </Link>
        </>
      }
    >
      <SignInForm next={next} />
    </AuthCard>
  );
}
