import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";
import { ConfirmEmail } from "@/components/auth/confirm-email";
import { parseConfirmationLink } from "@/lib/auth-links";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("confirmTitle"), robots: { index: false } };
}

export default async function ConfirmEmailPage({ searchParams }: PageProps<"/email-tasdiqlash">) {
  const t = await getTranslations("Auth");
  const link = parseConfirmationLink(await searchParams);

  return (
    <AuthCard title={t("confirmTitle")}>
      <ConfirmEmail link={link} />
    </AuthCard>
  );
}
