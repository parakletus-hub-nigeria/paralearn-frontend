import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import LandingPage from "@/components/landingpage/page";
import SabiNoteLanding from "@/components/landingpage/SabiNoteLanding";
import { parseSubdomainFromHostname } from "@/lib/subdomainManager";
import { routespath } from "@/lib/routepath";
import { SITES } from "@/lib/seo/siteConfig";
import { StructuredData } from "@/components/seo/StructuredData";

/**
 * Which marketing surface renders at "/" depends entirely on which host the
 * request came in on (pln.ng vs sabinote.app vs a school tenant subdomain).
 * That decision used to happen client-side, after hydration, behind a loading
 * spinner — meaning a crawler that doesn't execute JavaScript (PerplexityBot,
 * GPTBot, and most non-Google AI crawlers) saw the spinner shell and nothing
 * else. Resolving it here, from the `Host` header on the server, means the
 * first byte of HTML is already the real page: this is the single highest-
 * leverage F_render/G_gate fix available for either domain's homepage.
 */
async function resolveHostContext() {
  const host = (await headers()).get("host") || "";
  const hostname = host.split(":")[0];
  const subdomain = parseSubdomainFromHostname(hostname);
  return { subdomain: subdomain?.toLowerCase() ?? null };
}

export async function generateMetadata(): Promise<Metadata> {
  const { subdomain } = await resolveHostContext();

  if (subdomain === "sabinote") {
    return {
      title: "SabiNote - AI Lesson Notes for Nigerian Teachers",
      description: SITES.sabinote.description,
      alternates: { canonical: "/" },
      robots: { index: true, follow: true },
    };
  }

  return {
    title: "ParaLearn - Modern Result Management for African Schools",
    description: SITES.paralearn.description,
    alternates: { canonical: "/" },
    robots: { index: true, follow: true },
  };
}

export default async function Home() {
  const { subdomain } = await resolveHostContext();

  // A school tenant (or the authenticated app host, app.pln.ng) has no
  // marketing content of its own — send it straight to sign-in server-side,
  // same as the previous client-side redirect did, but without ever sending
  // a marketing-page HTML shell first.
  if (subdomain && subdomain !== "www" && subdomain !== "sabinote") {
    redirect(routespath.SIGNIN);
  }

  if (subdomain === "sabinote") {
    return (
      <>
        <StructuredData site="sabinote" />
        <SabiNoteLanding />
      </>
    );
  }

  return (
    <>
      <StructuredData site="paralearn" />
      <LandingPage />
    </>
  );
}
