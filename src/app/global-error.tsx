"use client";

import messages from "../../messages/uz.json";

import "./globals.css";

// Replaces the root layout when it fails, so no i18n provider is available here:
// strings are read straight from the default locale's message file.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = messages.Error;

  return (
    <html lang="uz">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-muted-foreground">{t.text}</p>
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {t.retry}
        </button>
      </body>
    </html>
  );
}
