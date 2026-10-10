import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { routes } from "@/lib/routes";
import { getViewer } from "@/server/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("signUpTitle"), robots: { index: false } };
}

export default async function SignUpPage() {
  if (await getViewer()) redirect(routes.home);

  const t = await getTranslations("Auth");

  return (
    <AuthCard
      title={t("signUpTitle")}
      description={t("signUpSubtitle")}
      footer={
        <>
          {t("haveAccount")}{" "}
          <Link href={routes.signIn} className="font-medium text-primary hover:underline">
            {t("signInLink")}
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
