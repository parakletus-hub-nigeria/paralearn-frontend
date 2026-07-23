/**
 * Central registry for the two public marketing surfaces this deployment serves
 * (ParaLearn and SabiNote) plus the rules that keep private/tenant hosts out of
 * search and AI-crawler indexes.
 *
 * robots.ts, sitemap.ts, llms.txt, and the root layout's metadata all read from
 * this one file so the "which host is public, which paths on it are private"
 * decision lives in exactly one place instead of drifting across four.
 */

export type SiteKey = "paralearn" | "sabinote";

interface SiteEntry {
  key: SiteKey;
  name: string;
  baseUrl: string;
  hosts: string[]; // hostnames (no port) that resolve to this site's marketing surface
  description: string;
  sameAs: string[];
}

export const SITES: Record<SiteKey, SiteEntry> = {
  paralearn: {
    key: "paralearn",
    name: "ParaLearn",
    baseUrl: process.env.NEXT_PUBLIC_PARALEARN_URL || "https://pln.ng",
    hosts: ["pln.ng", "www.pln.ng", "paralearn.com", "www.paralearn.com"],
    description:
      "ParaLearn RMS helps African schools automate result compilation, CBT assessments, attendance, and reporting: move from paperwork to a unified digital system.",
    sameAs: [
      "https://x.com/paralearn",
      "https://www.instagram.com/paralearn.io",
      "https://www.linkedin.com/company/paralearn/",
    ],
  },
  sabinote: {
    key: "sabinote",
    name: "SabiNote",
    baseUrl: process.env.NEXT_PUBLIC_SABINOTE_URL || "https://sabinote.app",
    hosts: ["sabinote.app", "www.sabinote.app", "sabinote.com", "www.sabinote.com"],
    description:
      "SabiNote generates structured, NERDC curriculum-aligned lesson notes with AI, so teachers spend less time planning and more time teaching.",
    sameAs: [],
  },
};

/**
 * Hostname (no port) -> which site's marketing surface should render, or null
 * for app/tenant hosts (school.pln.ng, app.pln.ng, cbt.pln.ng, localhost dev,
 * etc.) that carry no public marketing content of their own.
 */
export function siteForHost(hostname: string): SiteKey | null {
  const lower = hostname.toLowerCase();
  for (const site of Object.values(SITES)) {
    if (site.hosts.includes(lower)) return site.key;
  }
  return null;
}

/**
 * Path prefixes that must stay out of search/AI-crawler indexes even on a
 * public marketing host: auth flows, and the authenticated app shell in the
 * rare case it's reached from a marketing host instead of app.pln.ng.
 */
export const NOINDEX_PATH_PREFIXES = [
  "/auth",
  "/RMS",
  "/teacher",
  "/student",
  "/uni-",
  "/super-admin",
  "/sabinote/auth",
  "/sabinote/dashboard",
  "/sabinote/profile",
  "/profile",
  "/settings",
  "/setup",
  "/reset-password",
  "/unauthorized",
];

/**
 * Marketing subpages that are still "Coming Soon" stubs. Left reachable (no
 * 404) but deliberately excluded from indexing and the sitemap: a thin,
 * near-empty page left indexable is a downrank reason, not a neutral no-op.
 */
export const THIN_CONTENT_SLUGS = ["pricing", "blog", "features"];

export function isNoindexPath(pathname: string): boolean {
  return NOINDEX_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
