import { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Key,
  Terminal,
  Zap,
  ShieldAlert,
  Webhook,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Database,
  UserCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Developer API Documentation | ParaLearn CBT",
  description:
    "RESTful API documentation and integration guide for connecting external LMS, schools, and tutorial centres into ParaLearn Computer-Based Testing.",
};

export default function CbtApiDocsPage() {
  return (
    <div className="min-h-screen bg-[#fdfdff] text-[#0f172a] font-sans antialiased selection:bg-[#641bc4]/10 selection:text-[#641bc4]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#e2e8f0] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/cbt"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#641bc4] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to CBT Workspace
            </Link>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-slate-900 text-sm">ParaLearn CBT API</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-violet-100 text-[#641bc4] border border-violet-200">
                v1.2.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/take"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              PIN Gate Runner
            </Link>
            <Link
              href="/cbt"
              className="text-xs font-bold px-3.5 py-1.5 rounded-lg bg-[#641bc4] hover:bg-[#5214a3] text-white transition-all shadow-sm"
            >
              CBT Workspace Hub
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="border-b border-[#e2e8f0] bg-gradient-to-b from-slate-50 to-white px-6 py-12 md:py-16">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            <span>High-Throughput Assessment Microservice Engine</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900">
            ParaLearn CBT <span className="text-[#641bc4]">Developer API</span>
          </h1>
          <p className="text-base md:text-lg text-slate-600 max-w-3xl leading-relaxed">
            Programmatically provision exams, manage question banks with LaTeX/Markdown, launch high-concurrency candidate test sessions, track real-time malpractice telemetry, and receive auto-graded results via HMAC-signed webhooks.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono">
            <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs flex items-center gap-2">
              <span className="text-slate-400">Base API URL:</span>
              <code className="text-[#641bc4] font-bold">https://cbt-api.pln.ng</code>
            </div>
            <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs flex items-center gap-2">
              <span className="text-slate-400">Protocol:</span>
              <code className="text-slate-700 font-bold">HTTPS / TLS 1.3</code>
            </div>
            <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs flex items-center gap-2">
              <span className="text-slate-400">Response Format:</span>
              <code className="text-emerald-700 font-bold">JSON (RFC 8259)</code>
            </div>
          </div>
        </div>
      </section>

      {/* Documentation Main Layout */}
      <main className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-12">
        {/* Sticky Sidebar Navigation */}
        <aside className="hidden md:block col-span-1 space-y-6">
          <div className="sticky top-24 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Documentation Guide</h2>
            <nav className="space-y-1 text-xs font-medium">
              <a href="#authentication" className="block py-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700">1. Authentication</a>
              <a href="#workspaces" className="block py-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700">2. Workspaces & Keys</a>
              <a href="#exams" className="block py-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700">3. Exams Management</a>
              <a href="#questions" className="block py-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700">4. Question Studio & LaTeX</a>
              <a href="#sessions" className="block py-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700">5. Candidate Runner & Telemetry</a>
              <a href="#proctoring" className="block py-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700">6. Proctoring Telemetry</a>
              <a href="#submission" className="block py-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700">7. Auto-Grading & Slips</a>
              <a href="#webhooks" className="block py-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700">8. Webhook Verification</a>
              <a href="#errors" className="block py-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700">9. Errors & Status Codes</a>
              <a href="#changelog" className="block py-1.5 px-2 rounded-md hover:bg-slate-100 text-[#641bc4] font-semibold">10. Versioning & Changelog</a>
            </nav>

            <div className="p-4 rounded-xl border border-violet-100 bg-violet-50/50 space-y-2">
              <p className="text-xs font-bold text-[#641bc4]">Need 30 Free Credits?</p>
              <p className="text-[11px] text-slate-600 leading-normal">
                Register a standalone exam hall workspace to test your integration without charge.
              </p>
              <Link
                href="/cbt/auth"
                className="inline-block text-[11px] font-bold text-[#641bc4] hover:underline"
              >
                Sign up for Exam Hall &rarr;
              </Link>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <div className="col-span-1 md:col-span-3 space-y-16">
          {/* Section 1: Authentication */}
          <section id="authentication" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-[#641bc4]" />
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">1. Authentication</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Every request from an external application must include your secret API key in the authorization header. You receive this key upon creating or signing in to an exam hall workspace.
            </p>
            <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-x-auto shadow-inner">
              <span className="text-slate-400"># Pass in standard Authorization header:</span>
              <br />
              <span className="text-emerald-400">Authorization:</span> Bearer pln_live_sk_sample_••••••••••••••••
              <br /><br />
              <span className="text-slate-400"># Or using the custom header:</span>
              <br />
              <span className="text-emerald-400">x-api-key:</span> pln_live_sk_sample_••••••••••••••••
            </div>
          </section>

          {/* Section 2: Workspaces */}
          <section id="workspaces" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#641bc4]" />
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">2. Workspaces & Developer Keys</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Create and manage autonomous workspaces for your academy, school, or tutorial centre. Each standalone workspace receives <strong>30 free candidate testing credits</strong> automatically upon creation.
            </p>

            {/* Endpoint 2.1: Register Standalone */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs font-bold">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">POST</span>
                  <span className="text-slate-700">/workspaces/standalone</span>
                </div>
                <span className="text-xs text-slate-500">Register Partner Exam Hall</span>
              </div>
              <div className="p-4 space-y-3 font-mono text-xs">
                <p className="font-sans font-semibold text-slate-700">Request Body:</p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`{
  "name": "Standard Assessment Centre",
  "ownerName": "Centre Administrator",
  "email": "examiner@example.com",
  "webhookUrl": "https://api.example.com/webhooks/cbt-results"
}`}
                </pre>
                <p className="font-sans font-semibold text-slate-700">Response (201 Created):</p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`{
  "id": "ws_sample_0001",
  "name": "Standard Assessment Centre",
  "type": "STANDALONE_HALL",
  "credits": 30,
  "apiKey": "pln_live_sk_sample_••••••••••••••••",
  "webhookSecret": "pln_whsec_sample_••••••••••••••••"
}`}
                </pre>
              </div>
            </div>

            {/* Endpoint 2.2: Examiner Sign In */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs font-bold">
                  <span className="px-2 py-0.5 bg-violet-100 text-[#641bc4] rounded">POST</span>
                  <span className="text-slate-700">/workspaces/login</span>
                </div>
                <span className="text-xs text-slate-500">Examiner Sign In & Recovery</span>
              </div>
              <div className="p-4 space-y-3 font-mono text-xs">
                <p className="font-sans text-xs text-slate-600">
                  Authenticates an examiner using their registered email. Restores their API keys, credit balance, and exam counts. If the account is new, it automatically provisions a workspace with 30 free test credits.
                </p>
                <p className="font-sans font-semibold text-slate-700">Request Body:</p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`{
  "email": "examiner@example.com",
  "password": "your_secure_password"
}`}
                </pre>
                <p className="font-sans font-semibold text-slate-700">Response (200 OK):</p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`{
  "id": "ws_sample_0001",
  "name": "Standard Assessment Centre",
  "ownerName": "Centre Administrator",
  "ownerEmail": "examiner@example.com",
  "credits": 30,
  "apiKey": "pln_live_sk_sample_••••••••••••••••",
  "_count": {
    "exams": 4,
    "questions": 150
  }
}`}
                </pre>
              </div>
            </div>

            {/* Endpoint 2.3: School SIS SSO */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs font-bold">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">POST</span>
                  <span className="text-slate-700">/workspaces/institution</span>
                </div>
                <span className="text-xs text-slate-500">ParaLearn School SIS SSO</span>
              </div>
              <div className="p-4 space-y-3 font-mono text-xs">
                <p className="font-sans font-semibold text-slate-700">Request Body:</p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`{
  "schoolId": "sch_sample_99182",
  "schoolName": "Exemplar Academy",
  "email": "admin@school.example.edu.ng"
}`}
                </pre>
              </div>
            </div>
          </section>

          {/* Section 3: Exams */}
          <section id="exams" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#641bc4]" />
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">3. Exams Management</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Provision exams with custom delivery policies including room code generation, anti-cheat limits, question shuffling, and optional <strong>date & time scheduling windows</strong> (<code>startsAt</code>, <code>endsAt</code>).
            </p>

            {/* Endpoint 3.1: Create Exam with Scheduling */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs font-bold">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">POST</span>
                  <span className="text-slate-700">/exams</span>
                </div>
                <span className="text-xs text-slate-500">Create & Schedule Exam</span>
              </div>
              <div className="p-4 space-y-3 font-mono text-xs">
                <p className="font-sans font-semibold text-slate-700">Request Body:</p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`{
  "workspaceId": "ws_sample_0001",
  "title": "UTME 2026 Mock — Mathematics",
  "durationMins": 60,
  "accessCode": "MOCK-MTH-26",
  "startsAt": "2026-10-02T09:00:00.000Z",
  "endsAt": "2026-10-02T17:00:00.000Z",
  "maxTabViolations": 3,
  "shuffleQuestions": true,
  "shuffleChoices": true,
  "showResultAfter": true
}`}
                </pre>
                <p className="font-sans font-semibold text-slate-700">Response (201 Created):</p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`{
  "id": "exam_clx9921",
  "workspaceId": "ws_sample_0001",
  "title": "UTME 2026 Mock — Mathematics",
  "accessCode": "MOCK-MTH-26",
  "durationMins": 60,
  "startsAt": "2026-10-02T09:00:00.000Z",
  "endsAt": "2026-10-02T17:00:00.000Z",
  "isPublished": true,
  "createdAt": "2026-09-29T18:00:00.000Z"
}`}
                </pre>
              </div>
            </div>

            {/* Endpoint 3.2: List Workspace Exams */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs font-bold">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">GET</span>
                  <span className="text-slate-700">/exams?workspaceId=&#123;id&#125;</span>
                </div>
                <span className="text-xs text-slate-500">List All Exam Rooms</span>
              </div>
              <div className="p-4 space-y-3 font-mono text-xs">
                <p className="font-sans font-semibold text-slate-700">Response (200 OK):</p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`[
  {
    "id": "exam_clx9921",
    "title": "UTME 2026 Mock — Mathematics",
    "accessCode": "MOCK-MTH-26",
    "durationMins": 60,
    "startsAt": "2026-10-02T09:00:00.000Z",
    "endsAt": "2026-10-02T17:00:00.000Z",
    "_count": {
      "questions": 40,
      "attempts": 14
    }
  }
]`}
                </pre>
              </div>
            </div>
          </section>

          {/* Section 4: Questions */}
          <section id="questions" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#641bc4]" />
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">4. Question Studio & LaTeX Ingestion</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Questions support full Markdown and LaTeX mathematical notation (e.g. <code>$E = mc^2$</code>). You can inject questions in bulk or upload an <code>.xlsx</code> spreadsheet via <code>POST /questions/import-excel</code>.
            </p>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs font-bold">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">POST</span>
                  <span className="text-slate-700">/questions/bulk</span>
                </div>
                <span className="text-xs text-slate-500">Bulk Ingest Questions</span>
              </div>
              <div className="p-4 space-y-3 font-mono text-xs">
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`{
  "workspaceId": "ws_sample_0001",
  "examId": "exam_sample_101",
  "questions": [
    {
      "prompt": "Calculate the kinetic energy: $E_k = \\\\frac{1}{2}mv^2$ for $m=2\\\\text{kg}, v=3\\\\text{m/s}$",
      "type": "MCQ",
      "marks": 1.0,
      "options": [
        { "id": "opt_a", "keyLabel": "A", "text": "6 Joules", "isCorrect": false },
        { "id": "opt_b", "keyLabel": "B", "text": "9 Joules", "isCorrect": true }
      ],
      "explanation": "$E_k = 0.5 \\\\times 2 \\\\times 3^2 = 9\\\\text{ J}$."
    }
  ]
}`}
                </pre>
              </div>
            </div>

            {/* Endpoint 4.2: Multimodal AI Question Extraction (Gemini 3) */}
            <div className="border border-violet-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="bg-violet-50/60 px-4 py-2.5 border-b border-violet-100 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs font-bold">
                  <span className="px-2 py-0.5 bg-violet-600 text-white rounded">POST</span>
                  <span className="text-slate-800">/api/cbt/ai/generate-questions</span>
                </div>
                <span className="text-xs font-bold text-violet-700">Multimodal Gemini 3 AI Ingestion</span>
              </div>
              <div className="p-4 space-y-3 font-mono text-xs">
                <p className="font-sans text-xs text-slate-600 leading-relaxed">
                  Extracts context and concepts directly from uploaded lecture documents (PDF, Word, TXT), presentation slide decks (PPTX), audio recordings (MP3, WAV), or lecture videos (MP4), calibrating question difficulty according to Bloom&apos;s Taxonomy.
                </p>
                <p className="font-sans font-semibold text-slate-700">Multipart Form Fields:</p>
                <ul className="font-sans text-xs text-slate-600 list-disc list-inside space-y-1">
                  <li><code>file</code> (Binary, optional): PDF document, PPTX slides, MP3/WAV audio, or MP4 video (up to 40MB).</li>
                  <li><code>notes</code> (String, optional): Plaintext or markdown lecture notes/transcripts.</li>
                  <li><code>difficulty</code> (String): <code>simple</code> (recall), <code>intermediate</code> (application), <code>hard</code> (synthesis), or <code>balanced</code> (progressive mix).</li>
                  <li><code>count</code> (Integer): Target number of questions to author (default: 10).</li>
                  <li><code>subject</code> (String): Topic or curriculum context.</li>
                </ul>
                <p className="font-sans font-semibold text-slate-700">Response (200 OK):</p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`{
  "success": true,
  "modelUsed": "gemini-3-flash-preview",
  "difficulty": "balanced",
  "totalGenerated": 10,
  "questions": [
    {
      "id": "gemini_q_17907502",
      "prompt": "According to Newton's Second Law, if the net force acting on an object is doubled while its mass remains constant, the acceleration will:",
      "type": "MCQ",
      "marks": 1.0,
      "difficulty": "simple",
      "citation": "Slide 4 (F = ma)",
      "explanation": "Acceleration is directly proportional to net force for constant mass.",
      "options": [
        { "id": "opt_0_0", "text": "Double", "isCorrect": true },
        { "id": "opt_0_1", "text": "Halve", "isCorrect": false },
        { "id": "opt_0_2", "text": "Remain unchanged", "isCorrect": false },
        { "id": "opt_0_3", "text": "Quadruple", "isCorrect": false }
      ]
    }
  ]
}`}
                </pre>
              </div>
            </div>
          </section>

          {/* Section 5: Sessions */}
          <section id="sessions" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-[#641bc4]" />
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">5. Candidate Runner & Session Ingestion</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              When a student starts an exam via <code>POST /attempts/start</code>, all correct answer keys are stripped from the response payload for strict security. Live answers are buffered in high-throughput in-memory caching (<span className="font-semibold text-emerald-600">&lt;5ms latency</span>) to prevent database contention during concurrent mock tests.
            </p>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs font-bold">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">POST</span>
                  <span className="text-slate-700">/attempts/start</span>
                </div>
                <span className="text-xs text-slate-500">Initiate Candidate Session</span>
              </div>
              <div className="p-4 space-y-3 font-mono text-xs">
                <p className="font-sans font-semibold text-slate-700">Request Body:</p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`{
  "accessCode": "MOCK-SCI-26",
  "candidatePin": "849201",
  "candidateName": "Sample Candidate",
  "studentId": "std_demo_101"
}`}
                </pre>
                <p className="font-sans font-semibold text-slate-700">Response (200 OK — Correct answer keys omitted):</p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`{
  "isResumed": false,
  "attemptId": "att_sample_202",
  "examId": "exam_sample_101",
  "examTitle": "UTME 2026 Mock — General Science",
  "candidateName": "Sample Candidate",
  "remainingSeconds": 3600,
  "violations": 0,
  "maxTabViolations": 3,
  "questions": [
    {
      "id": "q_01",
      "prompt": "Calculate kinetic energy: $E_k = \\\\frac{1}{2}mv^2$...",
      "options": [
        { "id": "opt_a", "keyLabel": "A", "text": "6 Joules" },
        { "id": "opt_b", "keyLabel": "B", "text": "9 Joules" }
      ]
    }
  ]
}`}
                </pre>
              </div>
            </div>
          </section>

          {/* Section 6: Proctoring */}
          <section id="proctoring" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">6. Proctoring & Anti-Cheat Telemetry</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              The client runner monitors browser window blur, tab switches, and fullscreen exits. Every event is dispatched to <code>POST /attempts/:id/telemetry</code>. If violations exceed <code>maxTabViolations</code>, the candidate is automatically disqualified and the session is locked.
            </p>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs font-bold">
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded">POST</span>
                  <span className="text-slate-700">/attempts/:id/telemetry</span>
                </div>
                <span className="text-xs text-slate-500">Record Breach Event</span>
              </div>
              <div className="p-4 space-y-3 font-mono text-xs">
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`{
  "type": "TAB_SWITCH",
  "meta": { "action": "window_blur" }
}`}
                </pre>
              </div>
            </div>
          </section>

          {/* Section 7: Auto-Grading */}
          <section id="submission" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">7. Deterministic Auto-Grading & WAEC Scoring</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Upon calling <code>POST /attempts/:id/submit</code>, the server deterministically auto-grades MCQ/TF questions, calculates the percentage, and computes the standard Nigerian WAEC/NECO grade:
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-xs font-mono">
              <div className="p-2 rounded bg-emerald-50 border border-emerald-200"><strong>&ge; 75%</strong>: A1</div>
              <div className="p-2 rounded bg-blue-50 border border-blue-200"><strong>&ge; 70%</strong>: B2</div>
              <div className="p-2 rounded bg-blue-50 border border-blue-200"><strong>&ge; 65%</strong>: B3</div>
              <div className="p-2 rounded bg-indigo-50 border border-indigo-200"><strong>&ge; 60%</strong>: C4</div>
              <div className="p-2 rounded bg-slate-50 border border-slate-200"><strong>&lt; 40%</strong>: F9</div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs mt-4">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs font-bold">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">POST</span>
                  <span className="text-slate-700">/attempts/:id/submit</span>
                </div>
                <span className="text-xs text-slate-500">Finalize & Auto-Grade</span>
              </div>
              <div className="p-4 space-y-3 font-mono text-xs">
                <p className="font-sans font-semibold text-slate-700">Response (200 OK):</p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`{
  "attemptId": "att_sample_202",
  "score": 36.0,
  "maxScore": 40.0,
  "percentage": 90.0,
  "grade": "A1",
  "status": "COMPLETED",
  "completedAt": "2026-09-29T17:40:00.000Z"
}`}
                </pre>
              </div>
            </div>
          </section>

          {/* Section 8: Webhooks */}
          <section id="webhooks" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2">
              <Webhook className="w-5 h-5 text-[#641bc4]" />
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">8. Webhook Verification</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              When an attempt is finalized, an <code>exam.attempt.completed</code> event is dispatched to your webhook URL with an <code>x-cbt-signature: sha256=&lt;hash&gt;</code> header.
            </p>

            <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-x-auto space-y-2">
              <p className="text-slate-400">// Node.js / Express Signature Verification:</p>
              <pre>
{`const crypto = require("crypto");

function verifyWebhook(rawBody, signature, secret) {
  const hash = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(\`sha256=\${hash}\`));
}`}
              </pre>
            </div>
          </section>

          {/* Section 9: Errors & Status Codes */}
          <section id="errors" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">9. Errors & HTTP Status Codes</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              ParaLearn CBT returns conventional HTTP status codes. Detailed error summaries are provided in standard RFC 7807 problem details format.
            </p>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                  <tr>
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2.5 px-4 font-mono font-bold text-emerald-600">200 / 201</td>
                    <td className="py-2.5 px-4 font-semibold">Success</td>
                    <td className="py-2.5 px-4 text-slate-600">Request processed successfully.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono font-bold text-amber-600">400</td>
                    <td className="py-2.5 px-4 font-semibold">Bad Request</td>
                    <td className="py-2.5 px-4 text-slate-600">Validation failure or missing required fields in payload.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono font-bold text-red-600">401</td>
                    <td className="py-2.5 px-4 font-semibold">Unauthorized</td>
                    <td className="py-2.5 px-4 text-slate-600">API Key is missing or invalid. Check your <code>Authorization: Bearer</code> header.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono font-bold text-rose-600">402</td>
                    <td className="py-2.5 px-4 font-semibold">Payment Required</td>
                    <td className="py-2.5 px-4 text-slate-600">Candidate testing credit exhausted. Top up your workspace credits.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono font-bold text-red-600">403</td>
                    <td className="py-2.5 px-4 font-semibold">Forbidden</td>
                    <td className="py-2.5 px-4 text-slate-600">Attempt disqualified due to proctoring violations or session locked.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-600">404</td>
                    <td className="py-2.5 px-4 font-semibold">Not Found</td>
                    <td className="py-2.5 px-4 text-slate-600">Requested workspace, exam, question, or attempt was not found.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-mono font-bold text-amber-600">429</td>
                    <td className="py-2.5 px-4 font-semibold">Too Many Requests</td>
                    <td className="py-2.5 px-4 text-slate-600">Rate limit exceeded (&gt; 120 req/min for general API, &gt; 600 req/min for live response buffering).</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 10: Versioning & Changelog */}
          <section id="changelog" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#641bc4]" />
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">10. API Versioning & Release Changelog</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              ParaLearn CBT uses semantic versioning (<code>MAJOR.MINOR.PATCH</code>). Breaking schema modifications increment the major version, while backwards-compatible endpoints and parameter additions increment minor versions.
            </p>

            <div className="space-y-4">
              {/* v1.2.0 */}
              <div className="border border-violet-200 bg-violet-50/40 rounded-xl p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-sm text-[#641bc4] bg-white px-2 py-0.5 rounded border border-violet-200">
                      v1.2.0
                    </span>
                    <span className="font-bold text-xs text-slate-900">Multimodal Gemini 3 AI Question Generation</span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Current Stable</span>
                </div>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                  <li>Added <code>POST /api/cbt/ai/generate-questions</code> for multimodal ingestion of documents (PDF, Word, TXT), slides (PPTX), audio (MP3, WAV), and video (MP4).</li>
                  <li>Integrated Bloom&apos;s Taxonomy difficulty tuning: <code>simple</code> (recall), <code>intermediate</code> (application), <code>hard</code> (synthesis), or <code>balanced</code> mix.</li>
                  <li>Automated psychometric distractor formulation with grounded citations (page/slide numbers or video timestamps).</li>
                  <li>Interactive AI Question Studio modal with preview, inline editing, and 1-click palette import.</li>
                </ul>
              </div>

              {/* v1.1.0 */}
              <div className="border border-slate-200 bg-white rounded-xl p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-sm text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      v1.1.0
                    </span>
                    <span className="font-bold text-xs text-slate-900">Multi-Exam Scheduling &amp; Window Controls</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">September 2026</span>
                </div>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                  <li>Added <code>startsAt</code> and <code>endsAt</code> ISO-8601 date/time window parameters on <code>POST /exams</code>.</li>
                  <li>Added <code>GET /exams?workspaceId=&#123;id&#125;</code> endpoint for listing all examination rooms in an exam hall.</li>
                  <li>Enabled independent examiners to manage and launch multiple distinct examinations concurrently.</li>
                  <li>Integrated candidate roster management with 1-click WhatsApp and magic link PIN dissemination.</li>
                </ul>
              </div>

              {/* v1.0.0 */}
              <div className="border border-slate-200 bg-white rounded-xl p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-sm text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      v1.0.0
                    </span>
                    <span className="font-bold text-xs text-slate-900">Initial Public Microservice Release</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">September 2026</span>
                </div>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                  <li>Core autonomous CBT workspace and standalone self-serve provisioning (30 free test credits).</li>
                  <li>Low-latency candidate session runner (Redis buffered response ingestion &lt;5ms).</li>
                  <li>Real-time anti-cheat telemetry and deterministic WAEC/NECO auto-grading.</li>
                  <li>HMAC-SHA256 signed webhook dispatches (<code>exam.attempt.completed</code>).</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
