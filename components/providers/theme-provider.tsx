"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wraps `next-themes` so the rest of the app never imports it directly.
 *
 * `attribute="class"` matches the `@custom-variant dark (&:is(.dark *))` declared in globals.css —
 * the variant keys off a `.dark` class on <html>, so the provider has to write a class rather
 * than a data attribute.
 *
 * `disableTransitionOnChange` suppresses transitions for the instant the class flips. Without it
 * every colour token animates at once and the switch reads as a slow wash rather than a change of
 * theme.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
