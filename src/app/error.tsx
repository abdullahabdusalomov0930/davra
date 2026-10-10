"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("Error");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("text")}</p>
      <div className="mt-6 flex gap-3">
        <Button onClick={() => retry()}>{t("retry")}</Button>
        <Button asChild variant="outline">
          <Link href="/">{t("backHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
