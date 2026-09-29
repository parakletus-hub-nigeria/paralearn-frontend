import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, Key, Terminal, Zap, ShieldAlert, Webhook, FileText, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Developer API Documentation | ParaLearn CBT",
  description: "RESTful API documentation and SDK guide for integrating ParaLearn Computer-Based Testing into external applications.",
};

export default function CbtApiDocsPage() {
  return (
    <div className="min-h-screen bg-[#fdfdff] text-[#0f172a] font-sans antialiased selection:bg-[#641bc4]/10 selection:text-[#641bc4]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#e2e8f0] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#641bc4] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to ParaLearn
            </Link>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-slate-900 text-sm">ParaLearn CBT API</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-violet-100 text-[#641bc4] border border-violet-200">
                v1.0.0
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
              <span className="text-slate-400">Production Base URL:</span>
              <code className="text-[#641bc4] font-bold">https://cbt-api.pln.ng</code>
            </div>
            <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs flex items-center gap-2">
              <span className="text-slate-400">Local Sandbox:</span>
              <code className="text-slate-700 font-bold">http://localhost:4000</code>
            </div>
            <a
              href="http://localhost:4000/api/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#641bc4] hover:underline flex items-center gap-1 font-sans font-semibold"
            >
              <Terminal className="w-3.5 h-3.5" />
              Open Interactive Swagger UI &rarr;
            </a>
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
              <a href="#questions" className="block py-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700">4. Question Studio</a>
              <a href="#sessions" className="block py-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700">5. Candidate Runner</a>
              <a href="#proctoring" className="block py-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700">6. Proctoring Telemetry</a>
              <a href="#submission" className="block py-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700">7. Auto-Grading & Slips</a>
              <a href="#webhooks" className="block py-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700">8. Webhook Verification</a>
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
              Every request from an external application must include your secret API key in the authorization header. You receive this key upon creating an exam hall workspace.
            </p>
            <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-x-auto shadow-inner">
              <span className="text-slate-400"># Pass in Authorization header</span>
              <br />
              <span className="text-emerald-400">Authorization:</span> Bearer pln_live_sk_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c
              <br />
              <span className="text-slate-400"># Or using custom header:</span>
              <br />
              <span className="text-emerald-400">x-api-key:</span> pln_live_sk_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c
            </div>
          </section>

          {/* Section 2: Workspaces */}
          <section id="workspaces" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#641bc4]" />
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">2. Workspaces & Developer Keys</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Create an autonomous workspace for your academy or tutorial centre. Each standalone workspace receives <strong>30 free candidate testing credits</strong> automatically.
            </p>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs font-bold">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">POST</span>
                  <span className="text-slate-700">/workspaces/standalone</span>
                </div>
                <span className="text-xs text-slate-500">Register Partner Workspace</span>
              </div>
              <div className="p-4 space-y-3 font-mono text-xs">
                <p className="font-sans font-semibold text-slate-700">Request Body:</p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`{
  "name": "Apex JAMB Academy",
  "ownerName": "Dr. Tunde Fashola",
  "email": "tunde@apexjamb.ng",
  "webhookUrl": "https://api.apexjamb.ng/webhooks/cbt-results"
}`}
                </pre>
                <p className="font-sans font-semibold text-slate-700">Response (201 Created):</p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`{
  "id": "cly7q1m8x0001",
  "name": "Apex JAMB Academy",
  "credits": 30,
  "apiKey": "pln_live_sk_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
  "webhookSecret": "pln_whsec_1234567890abcdef"
}`}
                </pre>
              </div>
            </div>
          </section>

          {/* Section 3: Exams */}
          <section id="exams" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#641bc4]" />
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">3. Exams Management</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Provision exams with custom delivery policies including room code generation, anti-cheat limits, question shuffling, and immediate result disclosure.
            </p>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs font-bold">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">POST</span>
                  <span className="text-slate-700">/exams</span>
                </div>
                <span className="text-xs text-slate-500">Create Exam</span>
              </div>
              <div className="p-4 space-y-3 font-mono text-xs">
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
{`{
  "workspaceId": "cly7q1m8x0001",
  "title": "JAMB UTME 2026 Mock — Physics",
  "durationMins": 60,
  "accessCode": "JAMB-MOCK-26",
  "maxTabViolations": 3,
  "shuffleQuestions": true,
  "shuffleChoices": true,
  "showResultAfter": true
}`}
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
              Questions support full Markdown and LaTeX mathematical notation (e.g. <code>$E = mc^2$</code>). You can inject questions in bulk or upload an <code>.xlsx</code> spreadsheet.
            </p>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
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
  "workspaceId": "cly7q1m8x0001",
  "examId": "exam_clx9921",
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
          </section>

          {/* Section 5: Sessions */}
          <section id="sessions" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-[#641bc4]" />
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">5. Candidate Runner & Live Buffering</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              When a student starts an exam via <code>POST /attempts/start</code>, all correct answer keys are stripped from the response payload for strict security. Live keystrokes and answers are buffered in Redis hash tables (<span className="font-semibold text-emerald-600">&lt;5ms latency</span>) to prevent database saturation during high-volume mock examinations.
            </p>
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
        </div>
      </main>
    </div>
  );
}
