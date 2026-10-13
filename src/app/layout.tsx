import type { Metadata, Viewport } from "next";
import { Mali, Onest, Unbounded } from "next/font/google";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { MagnetDots } from "@/components/layout/magnet-dots";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getPublicEnv } from "@/lib/env";
import { openGraphBase } from "@/lib/seo";
import { APP_NAME } from "@/lib/config";

import "./globals.css";

// The "Daftar" type (D78). All three draw oʻ/gʻ (U+02BB) and ʼ (U+02BC) as real letters in their Latin
// subset. Only Latin is preloaded; Cyrillic and Latin Extended stay declared with their unicode-range and
// download only on pages that use them, so phones on slow networks do not fetch fonts most pages never need.
// Body text: Onest, a clear grotesque with Cyrillic, so texts written in Cyrillic keep the same face.
const sans = Onest({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Headings: Unbounded, round and wide, like letters drawn with a thick marker.
const heading = Unbounded({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

// Handwritten notes in the margins (the landing page only), so it is not preloaded on every page.
const hand = Mali({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-hand",
  display: "swap",
  preload: false,
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
    { media: "(prefers-color-scheme: light)", color: "#fdfcf7" },
    { media: "(prefers-color-scheme: dark)", color: "#121317" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const t = await getTranslations("Nav");
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      className={`${sans.variable} ${heading.variable} ${hand.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <ThemeProvider nonce={nonce}>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:border-2 focus:border-foreground focus:bg-marker focus:px-4 focus:py-2 focus:font-semibold focus:text-ink focus:shadow-hard-sm"
            >
              {t("skipToContent")}
            </a>
            <MagnetDots />
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
