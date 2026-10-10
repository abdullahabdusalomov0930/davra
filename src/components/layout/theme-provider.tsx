"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Dark mode via the `.dark` class; follows the OS setting until the user picks one. */
export function ThemeProvider({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
      {children}
    </NextThemesProvider>
  );
}
