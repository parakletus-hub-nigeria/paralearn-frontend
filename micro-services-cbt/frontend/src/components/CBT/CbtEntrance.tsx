"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Code2,
  Flag,
  HardDrive,
  KeyRound,
  Loader2,
  Lock,
  PlusCircle,
  Printer,
  ShieldCheck,
  Timer,
} from "lucide-react";
import CbtBrand from "./CbtBrand";
import "./cbt-workspace.css";
import "./cbt-entrance.css";

/** Problems the page answers. Every answer here is true of the shipped product (see CBT_DESIGN_GUIDE.md §4). */
const PROBLEMS = [
  {
    problem: "Power and network fail mid-exam.",
    answer:
      "Each answer is saved on the candidate's computer first and sent when the connection returns. The clock comes from the server, so a reload doesn't reset it, and a submission made offline is delivered when the device reconnects.",
  },
  {
    problem: "Report cards mean re-typing every score.",
    answer:
      "For ParaLearn schools, an exam is linked to its class, subject and term when it is created. One click sends the scores to the right report-card column.",
  },
  {
    problem: "Malpractice is hard to control.",
    answer:
      "Questions and options can be shuffled for each candidate. Tab switches are counted, and at the examiner's limit the exam submits and locks.",
  },
  {
    problem: "Marking takes a whole weekend.",
    answer:
      "Objective questions are marked the moment a candidate submits. Essays are marked on screen, with ParaLearn AI suggesting a score against your rubric.",
  },
];

// School-facing facts the hero copy and code hint don't already say
const PROOF = ["WAEC-style grades", "Scores go to ParaLearn report cards", "Printed PIN slips and WhatsApp passes"];

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Exam-room preview: question states for the navigator (a = answered, f = flagged, c = current, '' = not yet)
const NAV_STATES = ["a", "a", "a", "a", "a", "f", "a", "a", "a", "a", "a", "a", "a", "c", "", "", "", "", "", ""];

export default function CbtEntrance() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);

  const goToCode = () => {
    document
      .getElementById("enter")
      ?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    codeInput.current?.focus({ preventScroll: true });
  };

  return (
    <div className="cbt-surface cbt-lp">
      <header className="cbt-lp-nav">
        <div className="cbt-lp-nav-inner">
          <div className="cbt-lp-nav-left">
            <CbtBrand />
            <nav aria-label="Page sections">
              <a href="#exam-room">Exam room</a>
              <a href="#resilience">Resilience</a>
              <a href="#features">Features</a>
              <a href="#developers">Developers</a>
            </nav>
          </div>
          <div className="cbt-lp-nav-right">
            <Link href="/cbt/auth" className="cbt-lp-portal">
              <ShieldCheck size={16} aria-hidden />
              <span className="cbt-lp-long">Examiner portal</span>
              <span className="cbt-lp-short">Sign in</span>
            </Link>
            <button type="button" className="cbt-button primary" onClick={goToCode}>
              Candidate entry
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="cbt-lp-hero">
          <div className="cbt-lp-hero-bg" aria-hidden />
          <div className="cbt-lp-float is-left" aria-hidden>
            <HardDrive size={16} />
            <span>
              <strong>Answers saved on this computer</strong>
              <small>Sent when the network returns</small>
            </span>
          </div>
          <div className="cbt-lp-float is-right" aria-hidden>
            <Timer size={16} />
            <span>
              <strong>Server-timed exams</strong>
              <small>A reload never resets the clock</small>
            </span>
          </div>

          <p className="cbt-lp-pill">
            <span className="cbt-lp-dot" aria-hidden />
            Works offline
            <span aria-hidden>·</span>
            <em>Built in Nigeria</em>
          </p>
          <h1>
            Computer‑based exams that <span>never fail</span>.
          </h1>
          <p className="cbt-lp-sub">
            Built for Nigerian exam halls. Answers stay safe through generator cuts and dropped networks, and
            scores go straight to WAEC-style results and report cards.
          </p>

          <form
            id="enter"
            className="cbt-lp-code"
            onSubmit={(event) => {
              event.preventDefault();
              if (joining) return;
              if (!code.trim()) {
                codeInput.current?.focus();
                return;
              }
              setJoining(true);
              router.push(`/take/${encodeURIComponent(code.trim().toUpperCase())}`);
            }}
          >
            <label htmlFor="candidate-exam-code" className="sr-only">
              Exam access code
            </label>
            <div className="cbt-lp-code-row">
              <div className="cbt-lp-code-input">
                <KeyRound size={18} aria-hidden />
                <input
                  id="candidate-exam-code"
                  ref={codeInput}
                  required
                  maxLength={80}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="Exam code, e.g. MATH-8842"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                />
              </div>
              <button className="cbt-button primary" disabled={joining} aria-busy={joining} type="submit">
                {joining ? "Opening exam room..." : "Enter exam room"}
                {joining ? <Loader2 className="animate-spin" size={17} /> : <ArrowRight size={17} />}
              </button>
            </div>
            <p className="cbt-lp-code-hint">
              <CheckCircle2 size={14} aria-hidden />
              <span>
                <strong>No account needed.</strong> Have your PIN ready if your examiner gave you one.
              </span>
            </p>
          </form>

          <ul className="cbt-lp-proof" aria-label="What schools get">
            {PROOF.map((item) => (
              <li key={item}>
                <BadgeCheck size={15} aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section id="exam-room" className="cbt-lp-room-wrap" aria-labelledby="room-title">
          <h2 id="room-title" className="sr-only">
            What candidates see
          </h2>
          <div className="cbt-lp-room" role="img" aria-label="Preview of the ParaLearn CBT exam room: a maths question with four options, a timer and a question navigator">
            <div className="cbt-lp-room-bar" aria-hidden>
              <span className="cbt-lp-dots">
                <i />
                <i />
                <i />
              </span>
              <span className="cbt-lp-url">
                <Lock size={12} />
                cbt.pln.ng/take/MATH-8842
              </span>
              <span className="cbt-lp-saved">
                <CheckCircle2 size={13} />
                Saved
              </span>
              <span className="cbt-lp-timer">
                <Clock size={13} />
                01:42:19
              </span>
            </div>
            <div className="cbt-lp-room-head" aria-hidden>
              <p>
                <strong>SS2 Mathematics mock exam</strong>
                <span>Daniel Olawale · Lab B, PC 14</span>
              </p>
              <p className="cbt-lp-progress">
                <span>Section 1 of 2</span>
                <span className="cbt-lp-bar">
                  <i style={{ width: "84%" }} />
                </span>
                <strong>42/50 answered</strong>
              </p>
            </div>
            <div className="cbt-lp-room-body" aria-hidden>
              <div className="cbt-lp-question">
                <div className="cbt-lp-q-top">
                  <span>Question 14 of 50</span>
                  <span className="cbt-lp-flag">
                    <Flag size={12} />
                    Flagged for review
                  </span>
                </div>
                <div className="cbt-lp-stem">
                  <small>Solve the quadratic equation for real roots:</small>
                  <strong>2x² − 7x + 3 = 0</strong>
                  <small>Give both values of x.</small>
                </div>
                <ol className="cbt-lp-options">
                  {[
                    ["A", "x = 3 or x = 1/2", true],
                    ["B", "x = −3 or x = −1/2", false],
                    ["C", "x = 2 or x = 3/2", false],
                    ["D", "x = 7 or x = 1/3", false],
                  ].map(([letter, text, picked]) => (
                    <li key={letter as string} className={picked ? "is-picked" : ""}>
                      <b>{letter}</b>
                      <span>{text}</span>
                      {picked ? <CheckCircle2 size={16} /> : null}
                    </li>
                  ))}
                </ol>
                <div className="cbt-lp-q-foot">
                  <span className="cbt-lp-ghost">
                    <ArrowLeft size={14} />
                    Previous
                  </span>
                  <span className="cbt-lp-keys">Keys A to D answer · N next · P back</span>
                  <span className="cbt-lp-next">
                    Next question
                    <ArrowRight size={14} />
                  </span>
                </div>
              </div>
              <div className="cbt-lp-navigator">
                <p>
                  <strong>Question navigator</strong>
                  <span>50 questions</span>
                </p>
                <div className="cbt-lp-grid">
                  {NAV_STATES.map((state, i) => (
                    <span key={i} className={state ? `is-${state}` : ""}>
                      {i + 1}
                    </span>
                  ))}
                </div>
                <ul className="cbt-lp-legend">
                  <li className="is-a">Answered</li>
                  <li className="is-c">Current</li>
                  <li className="is-f">Flagged</li>
                </ul>
                <span className="cbt-lp-submit">
                  <CheckCircle2 size={14} />
                  Submit section
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="resilience" className="cbt-lp-band" aria-labelledby="resilience-title">
          <div className="cbt-lp-inner cbt-lp-resilience">
            <div className="cbt-lp-resilience-intro">
              <p className="cbt-lp-eyebrow">The problem we solve</p>
              <h2 id="resilience-title">Built for West African realities.</h2>
              <p>
                Generators trip, data runs out and the exam still has to finish. Most online test tools lose
                answers when the connection drops. ParaLearn CBT was built for the hall you actually have.
              </p>
              <ol className="cbt-lp-flow" aria-label="How an answer is kept safe">
                <li>
                  <span>1</span>
                  Candidate picks an answer
                </li>
                <li>
                  <span>2</span>
                  Saved on the computer at once
                </li>
                <li>
                  <span>3</span>
                  Sent to ParaLearn when online
                </li>
              </ol>
            </div>
            <ol className="cbt-lp-problems">
              {PROBLEMS.map((p, i) => (
                <li key={p.problem}>
                  <span className="cbt-lp-num">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{p.problem}</h3>
                    <p>{p.answer}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="cbt-lp-features" aria-labelledby="features-title">
          <div className="cbt-lp-inner">
            <h2 id="features-title">One place to set, sit, mark and record exams.</h2>
            <p className="cbt-lp-lead">Everything an exam hall needs, from the first question to the report card.</p>

            <div className="cbt-lp-bento">
              <article className="cbt-lp-tile is-wide">
                <div className="cbt-lp-tile-top">
                  <p className="cbt-lp-tag">Live monitor</p>
                  <span className="cbt-lp-live">
                    <span className="cbt-lp-dot" aria-hidden />
                    48 of 50 sitting
                  </span>
                </div>
                <h3>Watch every candidate as they write</h3>
                <p>
                  See progress and tab-switch flags as they happen. Add five minutes, force-submit, or unlock a
                  locked PIN from one screen.
                </p>
                <table className="cbt-lp-mini" aria-label="Example of the live monitor">
                  <thead>
                    <tr>
                      <th>Seat and candidate</th>
                      <th>Progress</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <b>LAB-01</b> Adebayo, Samuel
                      </td>
                      <td className="is-good">44/50</td>
                      <td>
                        <span className="cbt-lp-chip">+5 min</span>
                      </td>
                    </tr>
                    <tr className="is-warn">
                      <td>
                        <b>LAB-02</b> Okafor, Chidinma <em>2 tab switches</em>
                      </td>
                      <td>31/50</td>
                      <td>
                        <span className="cbt-lp-chip is-warn">Review</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </article>

              <article className="cbt-lp-tile">
                <p className="cbt-lp-tag">Essay marking</p>
                <h3>Mark theory answers on screen</h3>
                <p>ParaLearn AI suggests a score against your rubric. You approve or change it.</p>
                <div className="cbt-lp-rubric" aria-label="Example rubric scores">
                  <div>
                    <span>Method</span>
                    <b>14 / 20</b>
                    <i>
                      <em style={{ width: "70%" }} />
                    </i>
                  </div>
                  <div>
                    <span>Accuracy</span>
                    <b>7 / 10</b>
                    <i>
                      <em className="is-green" style={{ width: "70%" }} />
                    </i>
                  </div>
                </div>
              </article>

              <article className="cbt-lp-tile">
                <p className="cbt-lp-tag">Result slips</p>
                <h3>A slip for every candidate</h3>
                <p>Score, WAEC-style grade and an attempt reference, ready to download or print.</p>
                <div className="cbt-lp-slip">
                  <div>
                    <small>Daniel Olawale</small>
                    <strong>84%</strong>
                  </div>
                  <span className="cbt-lp-grade">A1</span>
                  <Printer size={18} aria-hidden />
                </div>
              </article>

              <article className="cbt-lp-tile is-wide">
                <p className="cbt-lp-tag">Question studio</p>
                <h3>Write, import or generate your questions</h3>
                <p>
                  Type questions yourself, import them from Excel, or let ParaLearn AI draft a set from your notes
                  for you to review. Objective, short-answer and essay questions sit in one exam.
                </p>
                <ul className="cbt-lp-formats">
                  <li className="is-on">
                    <strong>WAEC-style mock</strong>
                    <small>Objective + theory</small>
                  </li>
                  <li>
                    <strong>JAMB UTME practice</strong>
                    <small>Timed objective</small>
                  </li>
                  <li>
                    <strong>School term test</strong>
                    <small>CA + exam scores</small>
                  </li>
                </ul>
              </article>
            </div>

            <div id="developers" className="cbt-lp-api">
              <span className="cbt-lp-api-icon" aria-hidden>
                <Code2 size={18} />
              </span>
              <div>
                <strong>Developer API and webhooks</strong>
                <p>Run ParaLearn exams inside your own student portal or app.</p>
              </div>
              <Link href="/cbt/api-docs" className="cbt-button outline">
                Read the API docs
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>

        <section className="cbt-lp-cta" aria-labelledby="cta-title">
          <div className="cbt-lp-inner">
            <div>
              <p className="cbt-lp-eyebrow">For schools and tutorial centres</p>
              <h2 id="cta-title">Run your next mock or term exam on ParaLearn CBT.</h2>
              <p>
                Create a free exam hall in a few minutes. Schools already on ParaLearn sign in with their
                ParaLearn account.
              </p>
            </div>
            <div className="cbt-lp-cta-actions">
              <Link href="/cbt/auth?mode=register" className="cbt-button primary">
                Create free exam hall
                <PlusCircle size={16} />
              </Link>
              <button type="button" className="cbt-button cbt-lp-dark-btn" onClick={goToCode}>
                <KeyRound size={15} aria-hidden />
                Enter an exam code
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="cbt-lp-footer">
        <div className="cbt-lp-inner">
          <p>
            <strong>ParaLearn CBT</strong>
            <span>&copy; {new Date().getFullYear()} ParaLearn. Built in Nigeria.</span>
          </p>
          <nav aria-label="Footer">
            <Link href="/take">Candidate entrance</Link>
            <Link href="/cbt/auth">Examiner sign in</Link>
            <Link href="/cbt/api-docs">Developer API</Link>
            <a href="https://pln.ng" target="_blank" rel="noreferrer">
              ParaLearn
              <ArrowUpRight size={12} aria-hidden />
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
