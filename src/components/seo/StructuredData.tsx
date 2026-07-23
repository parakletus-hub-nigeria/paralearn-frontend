import { SITES, type SiteKey } from "@/lib/seo/siteConfig";

/**
 * JSON-LD for the marketing homepages. Two objects per site: an Organization
 * (identity, sameAs profile links — feeds knowledge-graph / entity-consistency
 * signals) and a SoftwareApplication (what the product actually is, feeds
 * both classic rich-result eligibility and answer-engine retrieval).
 *
 * Rendered only on the two public marketing homepages (see src/app/page.tsx),
 * never on tenant/app routes — structured data describing a private school
 * portal as a public "software application" would be actively misleading.
 */
export function StructuredData({ site }: { site: SiteKey }) {
  const entry = SITES[site];

  const organization: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: entry.name,
    url: entry.baseUrl,
    logo: `${SITES.paralearn.baseUrl}/mainLogo.svg`,
    description: entry.description,
    sameAs: entry.sameAs,
  };

  if (site === "sabinote") {
    organization.parentOrganization = {
      "@type": "Organization",
      name: SITES.paralearn.name,
      url: SITES.paralearn.baseUrl,
    };
  }

  const softwareApplication = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: site === "paralearn" ? "ParaLearn RMS" : "SabiNote",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    url: entry.baseUrl,
    description: entry.description,
    offers: {
      "@type": "Offer",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplication) }}
      />
    </>
  );
}
