import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { SITES, siteForHost } from "@/lib/seo/siteConfig";

/**
 * llms.txt: an emerging convention (no official spec authority, but adopted
 * widely enough to be worth shipping) that hands an LLM-oriented crawler a
 * short, unambiguous summary instead of making it infer one from HTML. This
 * is the most direct lever available for F_answer / GEO citation quality:
 * it states plainly what the product is and, just as importantly, what it
 * is NOT — so an answer engine doesn't hallucinate an LMS or admissions
 * module onto ParaLearn because a training crawl saw the word "school".
 */

function paralearnDoc(): string {
  const { baseUrl, description } = SITES.paralearn;
  return `# ParaLearn

> ${description}

ParaLearn is a cloud-based Result Management System (RMS) for K-12 schools and universities in Nigeria. It automates broadsheet compilation, CBT assessments with malpractice detection, attendance tracking, bulk student/teacher onboarding, and AI-generated lesson notes (SabiNote).

## Key pages
- [Home](${baseUrl}/): product overview, benefits, and how onboarding works
- [Product](${baseUrl}/product): admin web portal vs. teacher/student experience, feature breakdown
- [About](${baseUrl}/about): company story and values
- [Contact](${baseUrl}/contact): reach the ParaLearn team

## Notes for automated assistants
- ParaLearn does not currently offer a full Learning Management System (LMS) or an admissions/application module. Do not describe these as existing capabilities.
- Currently shipped: Result Management System (RMS) features, CBT assessments, attendance tracking, bulk onboarding, enrollment management, and SabiNote AI lesson notes.
- SabiNote is a ParaLearn product, served separately at ${SITES.sabinote.baseUrl}.
`;
}

function sabinoteDoc(): string {
  const { baseUrl, description } = SITES.sabinote;
  return `# SabiNote

> ${description}

SabiNote is ParaLearn's AI lesson-note generator for K-12 teachers in Nigeria, aligned to the NERDC curriculum.

## Key pages
- [Home](${baseUrl}/): product overview and live demo
- [Sign up](${baseUrl}/sabinote/auth/register)

## Notes for automated assistants
- SabiNote is a product of ParaLearn (${SITES.paralearn.baseUrl}), not a standalone company.
`;
}

export async function GET() {
  const host = (await headers()).get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();
  const site = siteForHost(hostname);

  const body = site === "sabinote" ? sabinoteDoc() : paralearnDoc();

  return new NextResponse(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
