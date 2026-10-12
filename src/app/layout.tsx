import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getPublicEnv } from "@/lib/env";
import { openGraphBase } from "@/lib/seo";
import { APP_NAME } from "@/lib/config";

import "./globals.css";

// Only Latin is preloaded: it covers Uzbek, including oʻ/gʻ (U+02BB) and ʼ (U+02BC). Cyrillic and Latin
// Extended stay declared with their unicode-range and download only on pages that use them, so phones
// on slow networks do not fetch ~130 KB of fonts most pages never need.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Headings (D77): Source Serif 4 with its optical-size axis, so large titles get the display cut. It
// draws oʻ/gʻ (U+02BB) and ʼ (U+02BC) as real letters (Literata, tried first, gives U+02BB no width)
// and covers Cyrillic, so titles written in Cyrillic keep the same face.
const serif = Source_Serif_4({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-heading",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  const title = t("title", { appName: APP_NAME });

  return {
    metadataBase: new URL(getPublicEnv().NEXT_PUBLIC_SITE_URL),
    title: { default: title, template: `%s · ${APP_NAME}` },
    description: t("description"),
    applicationName: APP_NAME,
    // Title and description fall through from each page; the image comes from opengraph-image files.
    openGraph: { ...openGraphBase, type: "website" },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf7ef" },
    { media: "(prefers-color-scheme: dark)", color: "#14100d" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const t = await getTranslations("Nav");
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang={locale} className={`${inter.variable} ${serif.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <ThemeProvider nonce={nonce}>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:shadow"
            >
              {t("skipToContent")}
            </a>
            <SiteHeader />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
            <Toaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
