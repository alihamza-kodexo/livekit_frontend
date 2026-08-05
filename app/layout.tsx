import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

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
  title: "Kodexo Voice Agent Dashboard",
  description:
    "Configure voice agents, manage Twilio numbers, and review call logs.",
};

/**
 * Every screen here reads live state — agent config from Supabase, numbers from
 * the Twilio API. Without this, Next prerenders these routes at build time and
 * an admin sees a snapshot taken before the credentials even existed. Route
 * segment config cascades, so this covers all child routes.
 */
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
