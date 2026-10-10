import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";
import { ResetRequestForm } from "@/components/auth/reset-request-form";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("resetTitle"), robots: { index: false } };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations("Auth");

  return (
    <AuthCard
      title={t("resetTitle")}
      description={t("resetSubtitle")}
      footer={
        <Link href={routes.signIn} className="font-medium text-primary hover:underline">
          {t("backToSignIn")}
        </Link>
      }
    >
      <ResetRequestForm />
    </AuthCard>
  );
}
