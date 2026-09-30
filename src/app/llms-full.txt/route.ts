import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { SITES, siteForHost } from "@/lib/seo/siteConfig";

function cbtFullDoc(): string {
  const { baseUrl } = SITES.cbt;
  return `# ParaLearn CBT - Comprehensive Technical & Domain Reference

## Overview
ParaLearn CBT is an enterprise-grade Computer-Based Testing and examination engine designed for African educational ecosystems, tutorial centres, private schools, polytechnics, and universities. It runs with equal fidelity on low-bandwidth school Wi-Fi and high-speed municipal connections.

## Key Features & Architecture

### 1. High-Throughput Candidate Runner
- Zero-friction PIN-based authentication at \`/take/[roomCode]\`.
- LaTeX mathematical formula rendering with KaTeX and standard GitHub-flavored Markdown.
- Progress visualization with a 5-column question palette grid and flagged question indicators.
- Crash recovery and answer auto-persistence across both localStorage and HTTP cookies (\`pln_cbt_active_attempt\`).

### 2. ParaLearn AI Question Studio
- Multimodal extraction directly from uploaded notes (PDF, Word, TXT), slides (PPTX), audio lectures (MP3, WAV), and class videos (MP4).
- Bloom's Taxonomy calibration:
  - Simple: Recall, core definitions, basic laws.
  - Intermediate: Concept application, scenario-based reasoning, data analysis.
  - Hard: Multi-step deduction, synthesis, edge-case evaluations.
  - Balanced: 35% Simple, 45% Intermediate, 20% Hard.
- Grounded citations linking every question back to page numbers, slide titles, or media timestamps.

### 3. Anti-Malpractice Telemetry
- Page Visibility API listeners that detect window blurs, tab switching, and OS minimization.
- Automatic strike incrementation with configurable maximum violation limits.
- Automatic attempt locking and instant submission upon threshold breach.

### 4. Examination Scheduling & Multiple Rooms
- Exam halls can host multiple exams with distinct schedules (date windows, start times, durations).
- Real-time invigilation monitor showing candidate telemetry, timer status, and progress.
- Candidate roster with printable photocard slips and 1-click WhatsApp exam pass dispatch.

### 5. Developer API (v1.2.0)
- Endpoints:
  - POST /workspaces/standalone
  - POST /exams
  - GET /exams/:id/questions
  - POST /exams/:id/questions
  - POST /api/cbt/ai/generate-questions
  - POST /sessions/start
  - POST /sessions/:id/buffer
  - POST /sessions/:id/submit
  - POST /sessions/:id/telemetry
- HMAC SHA-256 webhook signatures for secure external callbacks.

## Primary Canonical Links
- Website: ${baseUrl}
- Exam Runner: ${baseUrl}/take
- Developer Docs: ${baseUrl}/api-docs
- Examiner Registration: ${baseUrl}/auth
`;
}

export async function GET() {
  const host = (await headers()).get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();
  const site = siteForHost(hostname);

  const body = site === "cbt" ? cbtFullDoc() : cbtFullDoc();

  return new NextResponse(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
