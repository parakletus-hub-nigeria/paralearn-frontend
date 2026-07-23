import { headers } from "next/headers";
import type { MetadataRoute } from "next";
import { SITES, siteForHost, NOINDEX_PATH_PREFIXES } from "@/lib/seo/siteConfig";

/**
 * Named explicitly (rather than relying only on the wildcard "*" rule) so
 * the answer-engine crawlers this matters most for — the ones GEO citations
 * actually depend on — are never accidentally caught by some future
 * "block unknown bots" rule added to the wildcard entry without anyone
 * noticing they'd been swept up in it.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
];

/**
 * Calling headers() makes this route dynamic (rendered per-request instead
 * of once at build time) — required, because the correct robots.txt differs
 * by which host the request came in on.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();
  const site = siteForHost(hostname);

  // Unknown host: a school tenant portal, the authenticated app shell
  // (app.pln.ng), or a preview/staging domain. None of these carry public
  // marketing content. This is a deliberate G_gate = 0, not an oversight —
  // crawling a private school's data would be a leak, not an SEO win.
  if (!site) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: NOINDEX_PATH_PREFIXES },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: NOINDEX_PATH_PREFIXES,
      })),
    ],
    sitemap: `${SITES[site].baseUrl}/sitemap.xml`,
  };
}
