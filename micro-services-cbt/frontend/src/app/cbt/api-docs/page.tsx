import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, Key, Layers, ShieldAlert, Terminal, UserCheck, Webhook, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Developer API | ParaLearn CBT",
  description:
    "Integrate ParaLearn CBT into your school system or LMS: create exams and questions, enrol candidates, run attempts and receive signed results by webhook.",
};

type Access = "api-key" | "candidate" | "public";

const ACCESS_LABEL: Record<Access, { text: string; cls: string }> = {
  "api-key": { text: "API key", cls: "bg-violet-100 text-[#641bc4] border-violet-200" },
  candidate: { text: "Attempt token", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  public: { text: "Public", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const METHOD_CLS: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-800",
  POST: "bg-blue-100 text-blue-800",
  PATCH: "bg-amber-100 text-amber-800",
  DELETE: "bg-red-100 text-red-800",
};

function Endpoint({
  method,
  path,
  access,
  children,
  request,
  response,
}: {
  method: string;
  path: string;
  access: Access;
  children: React.ReactNode;
  request?: string;
  response?: string;
}) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-xs font-bold">
          <span className={`px-2 py-0.5 rounded ${METHOD_CLS[method]}`}>{method}</span>
          <span className="text-slate-800 break-all">{path}</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${ACCESS_LABEL[access].cls}`}>
          {ACCESS_LABEL[access].text}
        </span>
      </div>
      <div className="p-4 space-y-3 text-sm text-slate-600">
        <div className="space-y-2 leading-relaxed">{children}</div>
        {request && (
          <>
            <p className="text-xs font-semibold text-slate-700">Request body</p>
            <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto text-xs">{request}</pre>
          </>
        )}
        {response && (
          <>
            <p className="text-xs font-semibold text-slate-700">Response</p>
            <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto text-xs">{response}</pre>
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-5 scroll-mt-24">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-[#641bc4]" />
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

const NAV = [
  ["overview", "1. Overview"],
  ["authentication", "2. Authentication"],
  ["exams", "3. Exams"],
  ["questions", "4. Questions"],
  ["candidates", "5. Candidates"],
  ["attempts", "6. Taking an exam"],
  ["results", "7. Results & invigilation"],
  ["webhooks", "8. Webhooks"],
  ["errors", "9. Errors"],
];

export default function CbtApiDocsPage() {
  return (
    <div className="min-h-screen bg-[#fdfdff] text-[#0f172a] font-sans antialiased">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#e2e8f0] px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/cbt"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#641bc4] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to CBT Workspace
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-extrabold tracking-tight text-slate-900 text-sm">ParaLearn CBT API</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-violet-100 text-[#641bc4] border border-violet-200">
              v2
            </span>
          </div>
          <Link
            href="/cbt/settings"
            className="text-xs font-bold px-3.5 py-1.5 rounded-lg bg-[#641bc4] hover:bg-[#5214a3] text-white transition-all shadow-sm"
          >
            Get your API key
          </Link>
        </div>
      </header>

      <section className="border-b border-[#e2e8f0] bg-gradient-to-b from-slate-50 to-white px-4 sm:px-6 py-12">
        <div className="max-w-5xl mx-auto space-y-4">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900">
            ParaLearn CBT <span className="text-[#641bc4]">Developer API</span>
          </h1>
          <p className="text-base md:text-lg text-slate-600 max-w-3xl leading-relaxed">
            Create exams and question banks, enrol candidates, run attempts in your own interface or ours, and
            receive marked results through signed webhooks.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg">
              <span className="text-slate-400">Base URL: </span>
              <code className="text-[#641bc4] font-bold">https://cbt.pln.ng/api/cbt</code>
            </div>
            <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg">
              <span className="text-slate-400">Format: </span>
              <code className="text-slate-700 font-bold">JSON over HTTPS</code>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-12">
        <aside className="hidden md:block col-span-1">
          <nav className="sticky top-24 space-y-1 text-xs font-medium" aria-label="Sections">
            {NAV.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block py-1.5 px-2 rounded-md hover:bg-slate-100 text-slate-700">
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="col-span-1 md:col-span-3 space-y-16 min-w-0">
          <Section id="overview" icon={BookOpen} title="1. Overview">
            <ol className="list-decimal ml-5 space-y-1.5 text-sm text-slate-600">
              <li>Create an exam (<code>POST /exams</code>) and its questions (<code>POST /questions/bulk</code>).</li>
              <li>Attach the questions (<code>POST /exams/:id/questions</code>) and publish (<code>PATCH /exams/:id</code> with <code>isPublished: true</code>).</li>
              <li>
                Enrol candidates (<code>POST /candidates/bulk</code>). Each gets a PIN and a <code>launchUrl</code> into our hosted exam
                room, or run attempts in your own interface (section 6).
              </li>
              <li>Receive each result by webhook when it is submitted, and again once essays are marked.</li>
            </ol>
            <p className="text-sm text-slate-600">
              Times are ISO 8601 in UTC. Exams only accept candidates while published, inside their{" "}
              <code>startsAt</code>–<code>endsAt</code> window, and once they have questions.
            </p>
          </Section>

          <Section id="authentication" icon={Key} title="2. Authentication">
            <p className="text-sm text-slate-600 leading-relaxed">
              Sign in to your workspace and open <Link className="underline" href="/cbt/settings">Settings &amp; API keys</Link>{" "}
              to copy or rotate your key. Send it on every examiner request:
            </p>
            <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto text-xs">{`Authorization: Bearer pln_live_sk_...
# or
x-api-key: pln_live_sk_...`}</pre>
            <ul className="list-disc ml-5 space-y-1 text-sm text-slate-600">
              <li>A key only reaches its own workspace. Another workspace's exams, questions, candidates and attempts return <code>404</code>.</li>
              <li>
                Candidate requests (answer, report, submit, slip) use the <strong>attempt token</strong> returned by{" "}
                <code>POST /attempts/start</code>, sent as <code>x-attempt-token</code>. Your API key also works for attempts in your exams.
              </li>
              <li>Keep keys on your server. Never ship them in a browser or mobile app.</li>
            </ul>
          </Section>

          <Section id="exams" icon={Layers} title="3. Exams">
            <Endpoint
              method="POST"
              path="/exams"
              access="api-key"
              request={`{
  "title": "JSS2 Mathematics Mid-Term",
  "accessCode": "MTH-JSS2",          // optional; generated if omitted, must be unique
  "durationMins": 60,                // 1–600
  "startsAt": "2026-11-02T08:00:00Z",// optional window
  "endsAt": "2026-11-02T12:00:00Z",
  "accessType": "ACCESS_CODE",       // or "ROSTER_ONLY": enrolled candidates with their PIN only
  "instructions": "Answer all questions.",
  "maxTabViolations": 3,             // 1–20; the attempt locks when reached
  "shuffleQuestions": true,          // per candidate, stable on rejoin
  "shuffleChoices": true,            // true/false questions keep their order
  "showResultAfter": true,           // false: candidates see "results released later"
  "isPublished": false
}`}
            >
              Creates an exam in your workspace. Returns the exam (<code>201</code>); a taken access code returns{" "}
              <code>409</code>.
            </Endpoint>
            <Endpoint method="GET" path="/exams" access="api-key">
              Lists your exams.
            </Endpoint>
            <Endpoint method="GET" path="/exams/:id" access="api-key">
              The exam with its questions, including answer keys.
            </Endpoint>
            <Endpoint method="PATCH" path="/exams/:id" access="api-key" request={`{ "isPublished": true }`}>
              Updates any setting from <code>POST /exams</code>. Send <code>startsAt: null</code> to remove a schedule.
              Question lists and totals can't be set here.
            </Endpoint>
            <Endpoint method="POST" path="/exams/:id/questions" access="api-key" request={`{ "questionIds": ["q_...", "q_..."] }`}>
              Sets the exam's questions, in order (replaces the list; repeats are ignored). Total marks follow from the
              questions. Only your own questions are accepted.
            </Endpoint>
            <Endpoint method="DELETE" path="/exams/:id" access="api-key">
              Deletes an exam nobody has taken. One with attempts returns <code>409</code>: unpublish it instead.
            </Endpoint>
            <Endpoint
              method="GET"
              path="/exams/code/:accessCode"
              access="public"
              response={`{ "id": "...", "accessCode": "MTH-JSS2", "title": "...", "durationMins": 60,
  "totalQuestions": 40, "totalMarks": 40, "isPublished": true,
  "startsAt": null, "endsAt": null, "accessType": "ACCESS_CODE", "instructions": "..." }`}
            >
              What a candidate sees in the lobby. Contains no questions.
            </Endpoint>
          </Section>

          <Section id="questions" icon={Terminal} title="4. Questions">
            <Endpoint
              method="POST"
              path="/questions/bulk"
              access="api-key"
              request={`{
  "questions": [
    { "prompt": "2 + 2 = ?", "type": "MCQ", "marks": 1,
      "options": [ { "id": "a", "text": "3" }, { "id": "b", "text": "4", "isCorrect": true } ] },
    { "prompt": "Pick the prime numbers", "type": "MULTI_SELECT", "marks": 2,
      "options": [ { "text": "2", "isCorrect": true }, { "text": "4" }, { "text": "5", "isCorrect": true } ] },
    { "prompt": "Explain photosynthesis.", "type": "SHORT_ESSAY", "marks": 5,
      "minWords": 20, "maxWords": 100, "modelAnswer": "...", "keyTerms": ["chlorophyll", "light"] }
  ]
}`}
              response={`{ "count": 3, "questions": [ { "id": "q_...", ... } ] }`}
            >
              <p>
                Types: <code>MCQ</code> and <code>TRUE_FALSE</code> (exactly one correct option),{" "}
                <code>MULTI_SELECT</code> (one or more), <code>SHORT_ESSAY</code> and <code>LONG_ESSAY</code> (marked by
                the examiner). Objective questions need at least two options with text; options without an{" "}
                <code>id</code> get one. Every question is checked before any is saved; a problem returns{" "}
                <code>400</code> naming the question.
              </p>
              <p>
                Optional: <code>section</code>, <code>explanation</code>, <code>minWords</code>, <code>maxWords</code>,{" "}
                <code>modelAnswer</code>, <code>keyTerms</code>, <code>rubric</code>. Model answers and key terms are
                never sent to candidates.
              </p>
            </Endpoint>
            <Endpoint method="POST" path="/questions" access="api-key">
              Creates one question (same fields as one item above).
            </Endpoint>
            <Endpoint method="PATCH" path="/questions/:id" access="api-key" request={`{ "marks": 2 }`}>
              Changes only the fields you send. Changing a question re-marks the submitted attempts of every exam using
              it, so a corrected answer key applies to results already in.
            </Endpoint>
          </Section>

          <Section id="candidates" icon={UserCheck} title="5. Candidates">
            <Endpoint
              method="POST"
              path="/candidates/bulk"
              access="api-key"
              request={`{
  "examId": "exam_...",
  "candidates": [
    { "candidateName": "Amara Obi", "studentId": "STU-0042", "email": "amara@example.com",
      "externalAttemptId": "your-attempt-ref", "metadata": { "class": "JSS2A" } }
  ]
}`}
              response={`[ { "id": "cand_...", "candidateName": "Amara Obi", "candidatePin": "482913",
    "launchUrl": "https://cbt.pln.ng/take/MTH-JSS2?pin=482913&name=Amara%20Obi&..." } ]`}
            >
              Enrols candidates and issues each a unique PIN (or uses the <code>candidatePin</code> you send). The{" "}
              <code>studentId</code> you set here is the only one recorded on results; candidates can't supply their own.
            </Endpoint>
            <Endpoint method="POST" path="/candidates" access="api-key">
              Enrols one candidate (same fields as one item above, plus <code>examId</code>).
            </Endpoint>
            <Endpoint method="GET" path="/candidates?examId=..." access="api-key">
              The exam's roster with status and scores.
            </Endpoint>
            <Endpoint method="DELETE" path="/candidates/:id" access="api-key">
              Removes a candidate; their PIN stops working. Results already submitted are kept.
            </Endpoint>
          </Section>

          <Section id="attempts" icon={Zap} title="6. Taking an exam">
            <p className="text-sm text-slate-600">
              Send candidates to the <code>launchUrl</code>, or run the attempt in your own interface with these
              endpoints.
            </p>
            <Endpoint
              method="POST"
              path="/attempts/start"
              access="public"
              request={`{ "accessCode": "MTH-JSS2", "candidateName": "Amara Obi",
  "candidatePin": "482913",          // enrolled candidates; omit for a walk-in
  "externalAttemptId": "your-attempt-ref" }`}
              response={`{ "attemptId": "att_...", "attemptToken": "...", "candidatePin": "482913",
  "deadline": "2026-11-02T09:00:00Z", "serverNow": "...", "isResumed": false,
  "showResultAfter": true, "maxTabViolations": 3,
  "questions": [ { "id": "q_...", "prompt": "...", "type": "MCQ", "marks": 1,
                   "options": [ { "id": "b", "text": "4" } ] } ],
  "restoredAnswers": {} }`}
            >
              <p>
                Starts the attempt, or resumes a running one for the same PIN (a walk-in must also give the same name).
                Questions arrive without answer keys, in this attempt's order. Keep <code>attemptToken</code>: it
                authorises the calls below.
              </p>
              <p>
                Refusals: <code>403</code> exam not published, not yet open, closed, or registered candidates only;{" "}
                <code>404</code> unknown code or PIN; <code>409</code> already submitted, locked, or no questions yet.
              </p>
            </Endpoint>
            <Endpoint
              method="POST"
              path="/attempts/:id/answer"
              access="candidate"
              request={`{ "questionId": "q_...", "selectedVal": "b" }
// MULTI_SELECT: ["a","c"]   essays: the text   also accepted: { "selected": "b" }`}
            >
              Saves one answer while the attempt is running (accepted until 2 minutes past the deadline).
            </Endpoint>
            <Endpoint method="POST" path="/attempts/:id/telemetry" access="candidate" request={`{ "eventType": "tab_switch", "eventId": "unique-per-event" }`}>
              Records a tab switch. Repeating an <code>eventId</code> counts once. At <code>maxTabViolations</code> the
              attempt locks.
            </Endpoint>
            <Endpoint
              method="POST"
              path="/attempts/:id/submit"
              access="candidate"
              request={`{ "finalAnswers": { "q_1": "b", "q_2": ["a","c"], "q_3": "Photosynthesis is..." },
  "submittedAt": "2026-11-02T08:55:10Z" }`}
              response={`{ "status": "SUBMITTED", "gradingStatus": "AUTO_SCORED", "score": 32, "totalMarks": 40,
  "percentage": 80, "grade": "A1", "alreadySubmitted": false,
  "resultSlip": { "breakdown": { "correctCount": 32, "wrongCount": 6, "unansweredCount": 2,
                                  "mcqScore": 32, "essayScore": 0 } } }`}
            >
              <p>
                Marks the attempt. Objective answers are all-or-nothing; essays wait for the examiner (
                <code>gradingStatus: &quot;PENDING_REVIEW&quot;</code>). Submitting again returns the same result. A
                submission from an offline device that arrives after the deadline is accepted and flagged as synced late.
              </p>
              <p>
                With <code>showResultAfter: false</code> the score fields come back as <code>null</code> with{" "}
                <code>resultsWithheld: true</code>.
              </p>
            </Endpoint>
            <Endpoint method="GET" path="/attempts/:id/slip" access="candidate">
              The result slip for a finished attempt.
            </Endpoint>
            <Endpoint method="GET" path="/attempts/:id/status" access="candidate" response={`{ "status": "in_progress", "deadline": "...", "violations": 0, "serverNow": "..." }`}>
              Poll this while the attempt runs to pick up extra time or a lock.
            </Endpoint>
          </Section>

          <Section id="results" icon={ShieldAlert} title="7. Results & invigilation">
            <Endpoint method="GET" path="/exams/:id/monitor" access="api-key">
              Everyone on the exam: progress, tab switches, status and scores.
            </Endpoint>
            <Endpoint method="GET" path="/attempts/:id/review" access="api-key">
              A submitted attempt's full answer sheet with marking.
            </Endpoint>
            <Endpoint
              method="POST"
              path="/attempts/:id/manual-grade"
              access="api-key"
              request={`{ "answers": [ { "questionId": "q_3", "marksAwarded": 4, "feedback": "Good use of key terms." } ],
  "comment": "Well done overall." }`}
            >
              Marks essays (clamped to each question's marks). Feedback appears on the candidate's slip. When the last
              essay is marked, the <code>exam.attempt.graded</code> webhook is sent.
            </Endpoint>
            <Endpoint method="POST" path="/attempts/:id/extend" access="api-key" request={`{ "minutes": 5 }`}>
              Gives a running attempt extra time (1–240 minutes).
            </Endpoint>
            <Endpoint method="POST" path="/attempts/:id/reinstate" access="api-key">
              Reopens an attempt locked for tab switching (answers kept, count reset, at least 5 minutes left). The
              candidate rejoins with their name and PIN.
            </Endpoint>
            <Endpoint method="GET" path="/sync/export-csv/:examId" access="api-key">
              Results as a CSV file.
            </Endpoint>
          </Section>

          <Section id="webhooks" icon={Webhook} title="8. Webhooks">
            <p className="text-sm text-slate-600 leading-relaxed">
              Set a public <code>https://</code> URL in <Link className="underline" href="/cbt/settings">Settings</Link>.
              We POST <code>exam.attempt.completed</code> when an attempt is first submitted and{" "}
              <code>exam.attempt.graded</code> when its essays have all been marked. Headers:{" "}
              <code>x-cbt-event</code>, <code>x-cbt-event-id</code>, <code>x-cbt-timestamp</code> and{" "}
              <code>x-cbt-signature</code> (<code>sha256=</code> HMAC-SHA256 of the raw body with your webhook secret).
            </p>
            <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto text-xs">{`// Node.js (Express): verify before trusting the payload
const crypto = require("crypto");

app.post("/cbt-webhook", express.raw({ type: "application/json" }), (req, res) => {
  const expected = "sha256=" + crypto
    .createHmac("sha256", process.env.CBT_WEBHOOK_SECRET)
    .update(req.body)                       // the raw bytes, not re-serialised JSON
    .digest("hex");
  const given = req.get("x-cbt-signature") || "";
  const ok = given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return res.status(401).end();

  const event = JSON.parse(req.body);      // event.event, event.attemptId, event.score, ...
  res.status(200).end();
});`}</pre>
            <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto text-xs">{`{
  "event": "exam.attempt.completed",
  "eventId": "evt_...",
  "timestamp": "2026-11-02T08:55:11Z",
  "examId": "exam_...", "examCode": "MTH-JSS2",
  "attemptId": "att_...", "externalAttemptId": "your-attempt-ref",
  "studentId": "STU-0042", "candidateName": "Amara Obi", "candidatePin": "482913",
  "status": "SUBMITTED", "gradingStatus": "AUTO_SCORED",
  "score": 32, "totalMarks": 40, "percentage": 80, "grade": "A1",
  "startedAt": "...", "submittedAt": "...",
  "resultSlip": { "breakdown": { "correctCount": 32, "wrongCount": 6, "unansweredCount": 2 } },
  "metadata": { "class": "JSS2A" }
}`}</pre>
          </Section>

          <Section id="errors" icon={ShieldAlert} title="9. Errors">
            <p className="text-sm text-slate-600">
              Errors return <code>{`{ "message": "..." }`}</code> with a message you can show to users.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-slate-200">
                <tbody>
                  {[
                    ["400", "The request needs correcting (for example a question with no correct option)."],
                    ["401", "Missing or invalid API key, or attempt token."],
                    ["403", "Not allowed now: exam not open, closed, registered candidates only, or another workspace."],
                    ["404", "Not found, or not in your workspace."],
                    ["409", "Conflicts with the current state: code taken, attempt already submitted or locked."],
                    ["503", "Temporarily unavailable. Retry with backoff; the body includes retryable: true."],
                  ].map(([code, text]) => (
                    <tr key={code} className="border-b border-slate-200">
                      <td className="py-2 px-3 font-mono font-bold whitespace-nowrap">{code}</td>
                      <td className="py-2 px-3 text-slate-600">{text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
}
