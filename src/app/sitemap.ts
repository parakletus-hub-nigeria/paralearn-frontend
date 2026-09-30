import { headers } from "next/headers";
import type { MetadataRoute } from "next";
import { SITES, siteForHost, THIN_CONTENT_SLUGS } from "@/lib/seo/siteConfig";
import { LANDING_SUBPAGE_SLUGS } from "@/components/landingpage/subpages";

/**
 * Same host-aware pattern as robots.ts. Only lists pages that are actually
 * public and substantive — the "Coming Soon" stubs in THIN_CONTENT_SLUGS
 * are deliberately left out, same reasoning as their noindex tag.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();
  const site = siteForHost(hostname);
  const now = new Date();

  if (site === "sabinote") {
    return [
      {
        url: SITES.sabinote.baseUrl,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 1,
      },
    ];
  }

  if (site === "cbt") {
    return [
      {
        url: SITES.cbt.baseUrl,
        lastModified: now,
        changeFrequency: "daily",
        priority: 1.0,
      },
      {
        url: `${SITES.cbt.baseUrl}/api-docs`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.9,
      },
      {
        url: `${SITES.cbt.baseUrl}/take`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      },
      {
        url: `${SITES.cbt.baseUrl}/auth`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.7,
      },
    ];
  }

  // Default to the ParaLearn sitemap for the paralearn host and for any
  // unrecognized host — harmless, since robots.ts already blocks crawling
  // of unrecognized hosts entirely, so this file is only ever fetched by a
  // crawler that first read /robots.txt on an actual marketing host.
  const base = SITES.paralearn.baseUrl;
  const realSubpages = LANDING_SUBPAGE_SLUGS.filter(
    (slug) => !THIN_CONTENT_SLUGS.includes(slug)
  );

  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/cbt`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/cbt/api-docs`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/take`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...realSubpages.map((slug) => ({
      url: `${base}/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
