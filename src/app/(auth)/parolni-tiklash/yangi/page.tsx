import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";
import { NewPasswordForm } from "@/components/auth/new-password-form";
import { parseRecoveryLink } from "@/lib/auth-links";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("newPasswordTitle"), robots: { index: false } };
}

export default async function NewPasswordPage({ searchParams }: PageProps<"/parolni-tiklash/yangi">) {
  const t = await getTranslations("Auth");
  const link = parseRecoveryLink(await searchParams);

  return (
    <AuthCard title={t("newPasswordTitle")} description={link ? t("newPasswordSubtitle") : undefined}>
      <NewPasswordForm link={link} />
    </AuthCard>
  );
}
