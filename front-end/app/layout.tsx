import type { Metadata } from "next";
import { Cairo, DM_Mono, DM_Sans } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { resolveLocale } from "@/lib/i18n/server";
import { dirOf } from "@/lib/i18n/shared";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-dm-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

// DM Sans has no Arabic coverage. Cairo used to arrive through a render-blocking
// `@import url(fonts.googleapis.com)` at the top of globals.css; loading it here
// self-hosts it alongside the other two faces and drops that extra round trip.
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "pc store 39 — Informatique Reconditionnée",
  description:
    "Boutique d'ordinateurs et matériel informatique reconditionné garanti. Livraison 69 wilayas, paiement à la livraison.",
};

/**
 * `lang` and `dir` are resolved on the SERVER from the locale cookie, so the
 * first byte already carries the right direction — no flash of LTR before
 * hydration, and crawlers see the language the page is actually written in.
 * The back office always resolves to French LTR (see `resolveLocale`).
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await resolveLocale();

  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      className={`${dmSans.variable} ${dmMono.variable} ${cairo.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
