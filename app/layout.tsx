import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arbini Family",
  description: "A private board for the Arbini family.",
  // Nothing here is public, and the board describes where five people physically are. Keeping it
  // out of search results is the cheapest part of not publishing that.
  robots: { index: false, follow: false },
};

/**
 * Declares that both palettes exist, so the very first paint — before any JavaScript runs — can
 * use the system preference instead of being forced light.
 *
 * It is only half the story: `next-themes` then writes `style="color-scheme: <theme>"` onto
 * <html> once it knows the answer, and *that* is what makes native date pickers, selects and
 * scrollbars follow the app's own toggle rather than the operating system. Without it, choosing
 * light on a machine set to dark would leave the date inputs dark inside a light form.
 */
export const viewport = {
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // next-themes writes the theme class onto <html> before paint, which the server render cannot
    // predict. suppressHydrationWarning silences the resulting attribute mismatch on this element
    // only — it does not extend to the tree below.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          The Typekit headline face. A <link> rather than an @import in globals.css: an @import
          cannot start downloading until the importing stylesheet has been fetched and parsed,
          which puts the font one full round trip further back. preconnect opens the connection
          alongside that request instead of after it.
        */}
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="" />
        <link rel="preconnect" href="https://p.typekit.net" crossOrigin="" />
        <link rel="stylesheet" href="https://use.typekit.net/ykr1upq.css" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
