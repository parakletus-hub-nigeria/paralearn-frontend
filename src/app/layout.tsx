
import type { Metadata } from "next";
import { headers } from "next/headers";
import {Inter, Geist, Geist_Mono, Outfit, Manrope } from "next/font/google";
import "./globals.css";
import ClientComponent from "@/clientcomponet/ClientComponent";
import { SITES, siteForHost } from "@/lib/seo/siteConfig";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter", // Give it a CSS variable name
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

/**
 * Metadata is host-aware because this one deployment serves two distinct
 * public products (ParaLearn on pln.ng, SabiNote on sabinote.app) plus every
 * school tenant's private portal. The default here is "safe": only a host
 * that's on the public marketing allowlist gets an indexable, product-correct
 * title/description; everything else (tenant subdomains, app.pln.ng) falls
 * back to a generic, noindexed default so a private portal can never be
 * indexed under the wrong brand by omission.
 */
export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();
  const site = siteForHost(hostname);
  const entry = site ? SITES[site] : null;

  return {
    metadataBase: new URL(entry?.baseUrl ?? SITES.paralearn.baseUrl),
    title: {
      default:
        entry?.key === "sabinote"
          ? "SabiNote - AI Lesson Notes for Nigerian Teachers"
          : "ParaLearn - Modern Result Management for African Schools",
      template: entry?.key === "sabinote" ? "%s | SabiNote" : "%s | ParaLearn",
    },
    description: entry?.description ?? SITES.paralearn.description,
    icons: {
      icon: "/favicon.png",
    },
    // Marketing hosts leave this undefined so each page can opt itself in
    // (see (landing)/[slug]/page.tsx). Every other host — tenant portals,
    // the authenticated app shell — is noindexed at the root so nothing
    // under it can be indexed by omission.
    robots: site ? undefined : { index: false, follow: false },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-white">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body
        className={`${inter.variable} ${outfit.variable} ${manrope.variable} antialiased`}
      >
        <ClientComponent>
           {children}
        </ClientComponent>
      </body>
    </html>
  );
}
