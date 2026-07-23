import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LANDING_SUBPAGES } from "@/components/landingpage/subpages";
import { THIN_CONTENT_SLUGS } from "@/lib/seo/siteConfig";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Per-slug title/description. Every one of these pages previously inherited
 * the exact same root-layout title and description as the homepage — the
 * search-engine-visible equivalent of eleven identical business cards.
 */
const PAGE_META: Record<string, { title: string; description: string }> = {
  about: {
    title: "About ParaLearn",
    description:
      "ParaLearn was built to bridge the gap between the administrative efficiency African schools need and the educational excellence they strive for.",
  },
  product: {
    title: "Product",
    description:
      "See how ParaLearn splits the workload: administrators command from the web portal, teachers and students engage from their own devices.",
  },
  contact: {
    title: "Contact Us",
    description:
      "Get in touch with the ParaLearn team to register your school or ask a question about result management, CBT, or onboarding.",
  },
  careers: {
    title: "Careers",
    description:
      "Join ParaLearn and help modernize school result management across Africa.",
  },
  documentation: {
    title: "Documentation",
    description:
      "Guides and references for setting up and running your school on ParaLearn.",
  },
  partners: {
    title: "Partners",
    description: "Partner with ParaLearn to bring modern result management to more schools.",
  },
  help: {
    title: "Help Center",
    description: "Answers to common questions about ParaLearn's result management system.",
  },
  support: {
    title: "Support",
    description: "Get help from the ParaLearn support team.",
  },
  terms: {
    title: "Terms of Service",
    description: "The terms that govern use of ParaLearn's result management platform.",
  },
  privacy: {
    title: "Privacy Policy",
    description: "How ParaLearn collects, uses, and protects school, staff, and student data.",
  },
  security: {
    title: "Security",
    description: "How ParaLearn protects school records, exam integrity, and account access.",
  },
  cookies: {
    title: "Cookie Policy",
    description: "How ParaLearn uses cookies on its website and web app.",
  },
  pricing: {
    title: "Pricing",
    description: "ParaLearn pricing plans are being finalized. Contact us for a custom quote.",
  },
  blog: {
    title: "Blog",
    description: "News and updates from ParaLearn.",
  },
  features: {
    title: "Features",
    description: "An overview of ParaLearn's result management features.",
  },
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const meta = PAGE_META[slug];
  if (!meta) return {};

  // Thin/"Coming Soon" pages stay reachable but noindexed until they carry
  // real content — an indexable near-empty page drags down the whole
  // domain's quality signal more than not having the page at all.
  const isThin = THIN_CONTENT_SLUGS.includes(slug);

  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `/${slug}` },
    robots: isThin ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function LandingSubPage({ params }: PageProps) {
  const { slug } = await params;
  const Page = LANDING_SUBPAGES[slug];
  if (!Page) notFound();
  return <Page />;
}
